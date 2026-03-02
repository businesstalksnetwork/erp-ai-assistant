import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.540.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.540.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const doKey = Deno.env.get("DO_SPACES_KEY");
    const doSecret = Deno.env.get("DO_SPACES_SECRET");
    const doBucket = Deno.env.get("DO_SPACES_BUCKET");
    const doRegion = Deno.env.get("DO_SPACES_REGION") || "fra1";
    const doEndpoint = Deno.env.get("DO_SPACES_ENDPOINT");

    if (!doKey || !doSecret || !doBucket || !doEndpoint) throw new Error("DO Spaces not configured");

    const s3 = new S3Client({
      region: doRegion, endpoint: doEndpoint,
      credentials: { accessKeyId: doKey, secretAccessKey: doSecret },
      forcePathStyle: false,
    });

    const body = await req.json();
    const { action, tenantId, fileId, fileName, mimeType, s3Key, folderId, driveId, sizeBytes } = body;

    const { data: membership } = await supabase.from("tenant_members").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) throw new Error("Not a tenant member");

    if (action === "upload_init") {
      const fileUUID = crypto.randomUUID();
      const ext = fileName.split(".").pop() || "";
      const objectKey = s3Key || `tenant/${tenantId}/drives/${driveId}/${folderId}/${fileUUID}.${ext}`;

      await supabase.from("drive_files").insert({
        id: fileUUID, folder_id: folderId, drive_id: driveId, tenant_id: tenantId,
        original_name: fileName, s3_key: objectKey, mime_type: mimeType || "application/octet-stream",
        size_bytes: sizeBytes || 0, status: "PENDING", uploaded_by: user.id,
      });

      const command = new PutObjectCommand({ Bucket: doBucket, Key: objectKey, ContentType: mimeType || "application/octet-stream" });
      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
      await supabase.from("drive_audit_log").insert({ tenant_id: tenantId, actor_id: user.id, action: "FILE_UPLOAD", resource_type: "FILE", resource_id: fileUUID, resource_name: fileName });

      return new Response(JSON.stringify({ presignedUrl, fileId: fileUUID, s3Key: objectKey }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    if (action === "upload_confirm") {
      await supabase.from("drive_files").update({ status: "ACTIVE" }).eq("id", fileId).eq("tenant_id", tenantId);
      const { data: file } = await supabase.from("drive_files").select("size_bytes, drive_id").eq("id", fileId).single();
      if (file) await supabase.rpc("increment_drive_used_bytes", { p_drive_id: file.drive_id, p_bytes: file.size_bytes }).catch(() => {});
      return new Response(JSON.stringify({ success: true }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    if (action === "download") {
      const { data: file } = await supabase.from("drive_files").select("s3_key, original_name, mime_type").eq("id", fileId).eq("tenant_id", tenantId).single();
      if (!file) throw new Error("File not found");
      const command = new GetObjectCommand({ Bucket: doBucket, Key: file.s3_key, ResponseContentDisposition: `attachment; filename="${file.original_name}"` });
      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      await supabase.from("drive_audit_log").insert({ tenant_id: tenantId, actor_id: user.id, action: "FILE_DOWNLOAD", resource_type: "FILE", resource_id: fileId, resource_name: file.original_name });
      return new Response(JSON.stringify({ presignedUrl }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    if (action === "preview") {
      const { data: file } = await supabase.from("drive_files").select("s3_key, original_name, mime_type").eq("id", fileId).eq("tenant_id", tenantId).single();
      if (!file) throw new Error("File not found");
      const command = new GetObjectCommand({ Bucket: doBucket, Key: file.s3_key, ResponseContentType: file.mime_type });
      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      return new Response(JSON.stringify({ presignedUrl }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    if (action === "upload_new_version") {
      // Archive current file state, generate presigned URL for new version
      const { data: currentFile, error: cfErr } = await supabase
        .from("drive_files")
        .select("s3_key, version, size_bytes, mime_type, uploaded_by")
        .eq("id", fileId)
        .eq("tenant_id", tenantId)
        .single();
      if (cfErr || !currentFile) throw new Error("File not found");

      const currentVersion = currentFile.version || 1;

      // Archive current version
      await supabase.from("drive_file_versions").insert({
        file_id: fileId,
        tenant_id: tenantId,
        version_number: currentVersion,
        s3_key: currentFile.s3_key,
        size_bytes: currentFile.size_bytes || 0,
        mime_type: currentFile.mime_type || "application/octet-stream",
        uploaded_by: currentFile.uploaded_by || user.id,
      });

      // Generate new s3 key
      const ext = fileName?.split(".").pop() || "";
      const newObjectKey = s3Key || `tenant/${tenantId}/drives/${body.driveId}/${body.folderId}/${fileId}_v${currentVersion + 1}.${ext}`;

      const newCommand = new PutObjectCommand({
        Bucket: doBucket,
        Key: newObjectKey,
        ContentType: mimeType || currentFile.mime_type || "application/octet-stream",
      });
      const presignedUrl = await getSignedUrl(s3, newCommand, { expiresIn: 900 });

      // Update file record
      await supabase.from("drive_files").update({
        s3_key: newObjectKey,
        version: currentVersion + 1,
        size_bytes: sizeBytes || 0,
        mime_type: mimeType || currentFile.mime_type,
      }).eq("id", fileId).eq("tenant_id", tenantId);

      // Audit
      await supabase.from("drive_audit_log").insert({
        tenant_id: tenantId,
        actor_id: user.id,
        action: "FILE_NEW_VERSION",
        resource_type: "FILE",
        resource_id: fileId,
        resource_name: fileName || "unknown",
      });

      return new Response(JSON.stringify({ presignedUrl, fileId, s3Key: newObjectKey, newVersion: currentVersion + 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "restore_version") {
      const { versionId } = body;

      // Get current file
      const { data: currentFile, error: cfErr } = await supabase
        .from("drive_files")
        .select("s3_key, version, size_bytes, mime_type, uploaded_by, original_name")
        .eq("id", fileId)
        .eq("tenant_id", tenantId)
        .single();
      if (cfErr || !currentFile) throw new Error("File not found");

      // Get target version
      const { data: targetVersion, error: tvErr } = await supabase
        .from("drive_file_versions")
        .select("*")
        .eq("id", versionId)
        .eq("file_id", fileId)
        .eq("tenant_id", tenantId)
        .single();
      if (tvErr || !targetVersion) throw new Error("Version not found");

      const currentVersion = currentFile.version || 1;
      const newVersion = currentVersion + 1;

      // Archive current state
      await supabase.from("drive_file_versions").insert({
        file_id: fileId,
        tenant_id: tenantId,
        version_number: currentVersion,
        s3_key: currentFile.s3_key,
        size_bytes: currentFile.size_bytes || 0,
        mime_type: currentFile.mime_type || "application/octet-stream",
        uploaded_by: currentFile.uploaded_by || user.id,
      });

      // Restore target version's s3_key to current file
      await supabase.from("drive_files").update({
        s3_key: targetVersion.s3_key,
        version: newVersion,
        size_bytes: targetVersion.size_bytes,
        mime_type: targetVersion.mime_type,
      }).eq("id", fileId).eq("tenant_id", tenantId);

      // Audit
      await supabase.from("drive_audit_log").insert({
        tenant_id: tenantId,
        actor_id: user.id,
        action: "FILE_VERSION_RESTORE",
        resource_type: "FILE",
        resource_id: fileId,
        resource_name: currentFile.original_name,
      });

      return new Response(JSON.stringify({ success: true, restoredVersion: targetVersion.version_number, newVersion }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download_version") {
      const { versionId } = body;

      const { data: version, error: vErr } = await supabase
        .from("drive_file_versions")
        .select("s3_key, mime_type")
        .eq("id", versionId)
        .eq("tenant_id", tenantId)
        .single();
      if (vErr || !version) throw new Error("Version not found");

      const command = new GetObjectCommand({
        Bucket: doBucket,
        Key: version.s3_key,
      });
      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      return new Response(JSON.stringify({ presignedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "drive-presign" });
  }
});

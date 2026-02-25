import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.540.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.540.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    if (!doKey || !doSecret || !doBucket || !doEndpoint) {
      throw new Error("DO Spaces not configured");
    }

    const s3 = new S3Client({
      region: doRegion,
      endpoint: doEndpoint,
      credentials: { accessKeyId: doKey, secretAccessKey: doSecret },
      forcePathStyle: false,
    });

    const body = await req.json();
    const { action, tenantId, fileId, fileName, mimeType, s3Key, folderId, driveId, sizeBytes } = body;

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Not a tenant member");

    if (action === "upload_init") {
      // Create file record + return presigned PUT URL
      const fileUUID = crypto.randomUUID();
      const ext = fileName.split(".").pop() || "";
      const objectKey = s3Key || `tenant/${tenantId}/drives/${driveId}/${folderId}/${fileUUID}.${ext}`;

      const { data: fileRecord, error: insertErr } = await supabase
        .from("drive_files")
        .insert({
          id: fileUUID,
          folder_id: folderId,
          drive_id: driveId,
          tenant_id: tenantId,
          original_name: fileName,
          s3_key: objectKey,
          mime_type: mimeType || "application/octet-stream",
          size_bytes: sizeBytes || 0,
          status: "PENDING",
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      const command = new PutObjectCommand({
        Bucket: doBucket,
        Key: objectKey,
        ContentType: mimeType || "application/octet-stream",
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min

      // Audit log
      await supabase.from("drive_audit_log").insert({
        tenant_id: tenantId,
        actor_id: user.id,
        action: "FILE_UPLOAD",
        resource_type: "FILE",
        resource_id: fileUUID,
        resource_name: fileName,
      });

      return new Response(JSON.stringify({ presignedUrl, fileId: fileUUID, s3Key: objectKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload_confirm") {
      // Mark file as ACTIVE
      const { error } = await supabase
        .from("drive_files")
        .update({ status: "ACTIVE" })
        .eq("id", fileId)
        .eq("tenant_id", tenantId);
      if (error) throw error;

      // Update drive used_bytes
      const { data: file } = await supabase
        .from("drive_files")
        .select("size_bytes, drive_id")
        .eq("id", fileId)
        .single();
      if (file) {
        await supabase.rpc("increment_drive_used_bytes", {
          p_drive_id: file.drive_id,
          p_bytes: file.size_bytes,
        }).catch(() => {}); // non-critical
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      // Get file record, generate presigned GET
      const { data: file, error: fileErr } = await supabase
        .from("drive_files")
        .select("s3_key, original_name, mime_type")
        .eq("id", fileId)
        .eq("tenant_id", tenantId)
        .single();
      if (fileErr || !file) throw new Error("File not found");

      const command = new GetObjectCommand({
        Bucket: doBucket,
        Key: file.s3_key,
        ResponseContentDisposition: `attachment; filename="${file.original_name}"`,
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

      // Audit log
      await supabase.from("drive_audit_log").insert({
        tenant_id: tenantId,
        actor_id: user.id,
        action: "FILE_DOWNLOAD",
        resource_type: "FILE",
        resource_id: fileId,
        resource_name: file.original_name,
      });

      return new Response(JSON.stringify({ presignedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "preview") {
      const { data: file, error: fileErr } = await supabase
        .from("drive_files")
        .select("s3_key, original_name, mime_type")
        .eq("id", fileId)
        .eq("tenant_id", tenantId)
        .single();
      if (fileErr || !file) throw new Error("File not found");

      const command = new GetObjectCommand({
        Bucket: doBucket,
        Key: file.s3_key,
        ResponseContentType: file.mime_type,
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      return new Response(JSON.stringify({ presignedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

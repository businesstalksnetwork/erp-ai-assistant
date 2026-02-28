import React, { forwardRef } from "react";
import { useOfflineDetection } from "@/hooks/useOfflineDetection";
import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

export const OfflineBanner = forwardRef<HTMLDivElement>(
  function OfflineBanner(_props, ref) {
    const isOffline = useOfflineDetection();
    const { t } = useLanguage();

    return (
      <div ref={ref}>
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              className="fixed top-0 left-0 right-0 z-[9999] bg-destructive text-destructive-foreground text-center py-2 text-sm font-medium flex items-center justify-center gap-2"
            >
              <WifiOff className="h-4 w-4" />
              {t("offlineMessage")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

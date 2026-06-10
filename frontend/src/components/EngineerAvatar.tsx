"use client";

import { HardHat } from "lucide-react";
import { useEffect, useState } from "react";

import { getApiAssetUrl } from "@/src/lib/api";

type EngineerAvatarProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

export function EngineerAvatar({ src, alt, className = "" }: EngineerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = getApiAssetUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (resolvedSrc && !failed) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        onError={() => setFailed(true)}
        className={`h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm ${className}`}
      />
    );
  }

  return (
    <span
      className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6] shadow-sm ${className}`}
      aria-label={alt}
    >
      <HardHat className="h-7 w-7" aria-hidden="true" />
    </span>
  );
}

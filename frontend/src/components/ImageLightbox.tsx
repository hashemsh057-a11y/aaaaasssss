"use client";

import { X } from "lucide-react";

import { getApiAssetUrl } from "@/src/lib/api";

export function ImageLightbox({
  src,
  alt,
  onClose
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const resolvedSrc = getApiAssetUrl(src);
  if (!resolvedSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#07142c]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute end-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white text-[#15294d] shadow-xl"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <img
        src={resolvedSrc}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}

export function BrandLogo({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/quillayaa-logo.webp`}
      alt="Logo de QUILLAYAA"
      width={512}
      height={512}
      className={`shrink-0 rounded-xl bg-white object-contain ${className}`}
    />
  );
}

export function isSafeDisplayUrl(value: string | null) {
  return Boolean(
    value &&
    /^https?:\/\//i.test(value) &&
    !/\s|token|secret|cipher|presigned|s3:|r2:|key/i.test(value),
  );
}

export function ResourceExternalLink({
  href,
  label,
  ariaLabel,
}: {
  href: string;
  label: string;
  ariaLabel: string;
}) {
  return (
    <a
      className="button-like secondary resource-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
    >
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

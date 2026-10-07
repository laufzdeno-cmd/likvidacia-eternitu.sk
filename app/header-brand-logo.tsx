export default function HeaderBrandLogo() {
  return (
    <picture className="header-brand-picture">
      <source media="(min-width: 821px)" srcSet="/assets/astana-logo-dark.png" />
      <img
        className="brand-logo"
        src="/assets/astana-logo.png?surface=header"
        alt="ASTANA"
        width="195"
        height="65"
        loading="eager"
        decoding="async"
        fetchPriority="low"
      />
    </picture>
  );
}

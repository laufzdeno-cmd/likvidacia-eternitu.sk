const stylesheet = '/assets/home-below-fold.css';

export default function HomeDeferredStyles() {
  return (
    <noscript><link rel="stylesheet" href={stylesheet} /></noscript>
  );
}

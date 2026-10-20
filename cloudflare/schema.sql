-- TRANSBORA Pages + D1 — projet test mono-organisateur.
-- À appliquer une fois à la base Cloudflare D1 AVANT d'ouvrir le nouveau site.
-- Ne jamais placer le contenu de cette base ou les secrets dans GitHub.
CREATE TABLE IF NOT EXISTS transbora_records (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (bucket, key)
);
-- La clé composite indexe déjà les recherches individuelles du backend.

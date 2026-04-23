# Scripts Servicall

## ✅ Scripts autorisés

| Script               | Usage                                       |
|----------------------|---------------------------------------------|
| `db_remediation.sql` | Remise en cohérence DB (run une seule fois) |
| `seed-admin.ts`      | Créer le compte admin initial               |
| `deploy-vps.sh`      | Déploiement VPS                             |
| `setup-complete.sh`  | Setup initial du serveur                    |
| `clean-build.sh`     | Nettoyer les artefacts de build             |

## ⛔ Commandes interdites

```bash
# NE JAMAIS faire :
npx drizzle-kit push          # bypasse le journal
npx drizzle-kit push --force  # idem + destructif
psql -f schema_*.sql          # bypass Drizzle
```

## ✅ Commandes correctes

```bash
npx drizzle-kit migrate
psql $DATABASE_URL -f scripts/db_remediation.sql
```

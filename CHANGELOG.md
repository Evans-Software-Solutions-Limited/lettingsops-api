# Changelog

## 1.0.0 (2026-05-28)


### Features

* add Phase 1 schema (agencies, estate-agents, email-conversations, viewing-requests) ([#6](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/6)) ([691b326](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/691b326fbc96fb48aa2b033d0fedd3e4c5f461af))
* auto-reply service — SES outbound replies post-classification ([#15](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/15)) ([7deda19](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/7deda199d9cb6409068acc36b933f486e5a09953))
* Block C — structured logger, PII scrub, request context ([#33](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/33)) ([eeb3c9c](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/eeb3c9c32987da57ebbf25dfa0ab5e90c2a1a4c7))
* Block D — JWT verifier + Elysia auth plugin (off by default) ([#34](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/34)) ([1c74dc2](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/1c74dc2113d826ec3290bad1e41a620ba1ed05cf))
* Block E — Tenant isolation (introduce, sentinel-tolerant) ([#36](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/36)) ([d5ae746](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/d5ae746ed1a5d00cbd61139914ae4642120c3049))
* conversation state service ([#9](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/9)) ([f283f99](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/f283f9983e4932cb923f2fda7b47ce422303eebd))
* **db:** add agency_id to tenant-owned tables (Block E.0) ([#35](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/35)) ([fc261e3](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/fc261e323c5478e4322433161ccbe1cf328fd11b))
* **db:** Block B — api_keys table + ApiKeyRepository ([#32](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/32)) ([bc4ddfb](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/bc4ddfb1e0527b5660d3e092f7fab7dcf9ca6474))
* frontend overhaul v3 ([#19](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/19)) ([f097514](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/f097514a1440f25f6eb6e314ab64d25313205425))
* live lead dashboard + ElevenLabs phone scaffold ([#21](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/21)) ([c3db37c](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/c3db37c56b2b8fe6e1fb3ded5bab5c0844c56367))
* multi-type conversation classification + SES receipt rule ([#10](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/10)) ([50160dd](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/50160dd434d639d5654e923ddbead43ce30e2c64))
* Neon + Drizzle database layer ([#2](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/2)) ([8419209](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/8419209afc509654915d9f6af29a07df2f44f42e))
* Phase 1 frontend dashboard and lead management ([#4](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/4)) ([313b653](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/313b6535cc2bcc946f85d3bdfcebec7e3d37db83))
* scaffold Phase 1 lettings domain structure ([a54b85d](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/a54b85d0ae7042f26e65cbffa82bf2831849b3c2))
* SES email infrastructure stub and email processor Lambda entry point ([#7](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/7)) ([cfbb25d](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/cfbb25d40daa78b0a180ba9121e6c7aa1b826b3c))
* Tag Resources ([#14](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/14)) ([ffaff8a](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/ffaff8a242ddcda6000d43b45e84361f8c1b1cb8))
* Wire LLM extraction into lead creation pipeline ([#20](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/20)) ([a9e84aa](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/a9e84aad71c35d3cd2b0b4489da1e1c1b665f07a))


### Bug Fixes

* add S3 bucket policy to allow SES receipt rule writes ([#11](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/11)) ([7b28da8](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/7b28da829bc971f4e59a1c576b8dd4eb336ce037))
* Duplicate Secrets Instantiation ([#8](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/8)) ([8c7c880](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/8c7c8804377d21d752c9ae696e5821e89b1db7f0))
* ElevenLabs webhook processing + coverage violations + frontend wiring ([#22](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/22)) ([bfaab82](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/bfaab8214d21be9b8b577711fb77f5263a10deef))
* enforce 90% test coverage threshold ([#16](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/16)) ([fa16411](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/fa1641103c65a32e0ed46090aa04a46914a60fa3))
* format claude-review.yml to pass prettier --check ([7c6e107](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/7c6e107fb05cce8792a8dff87ca759a41dc352f5))
* Receipt Rule Setup ([#13](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/13)) ([6df733e](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/6df733ebee6f1fbe90adbcba527895a7aa0c5feb))
* rename all packages from sst-monorepo-template to lettingsops ([#1](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/issues/1)) ([0ce1ce2](https://github.com/Evans-Software-Solutions-Limited/lettingsops-api/commit/0ce1ce2f284a3a63c1498826d9c598d30d8d7d03))

# ServisDrama Kalıcı Ortak Veritabanı Kurulumu

1. Vercel projesinde **Storage / Marketplace → Neon Postgres** seçin.
2. Yeni veritabanını `servisdrama` projesine bağlayın.
3. Vercel Environment Variables bölümünde `DATABASE_URL` oluştuğunu doğrulayın.
4. Şu değişkenleri Production, Preview ve Development için ekleyin:
   - `JWT_SECRET`: uzun ve rastgele bir değer
   - `JWT_EXPIRE`: `12h`
   - `ADMIN_PASSWORD`: yönetici şifresi
5. Redeploy yapın. İlk açılışta tablolar ve başlangıç verileri otomatik oluşturulur.
6. `/api/health` adresi çalışmalı; girişten sonra `/api/state` ortak veriyi döndürür.

## Veri davranışı
- Firma, ziyaret, teknisyen, ayar ve numune kayıtları PostgreSQL içindeki `app_state` tablosunda ortak tutulur.
- Her kullanıcı aynı merkezi veriyi görür.
- İlk geçişte, mevcut tarayıcıdaki ziyaret sayısı sunucudakinden fazlaysa bu tarayıcı verisi otomatik olarak sunucuya taşınır.
- Vercel yeniden deploy edilse bile PostgreSQL verileri silinmez.

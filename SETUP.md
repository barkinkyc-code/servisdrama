# ServisDrama - Kurulum Rehberi

## 📋 Gereksinimler

- **Node.js** (v14+) - https://nodejs.org
- **MySQL** (v5.7+) - https://www.mysql.com
- **npm** (Node Package Manager) - Otomatik gelir

---

## 🚀 KURULUM ADIMLARI

### 1. Node.js Yükle

https://nodejs.org adresinden **LTS versiyonunu** indir ve kur.

Kurulum doğrulanması:
```bash
node --version
npm --version
```

### 2. MySQL Kur

https://dev.mysql.com/downloads/mysql/ adresinden MySQL Community Server'ı indir.

Kurulum sırasında:
- **Root Password**: `root123` (veya `.env`'de değiştir)
- **Port**: `3306` (default)

### 3. Veritabanı Oluştur

MySQL Console veya MySQL Workbench'te:

```bash
# MySQL'e bağlan
mysql -u root -p

# Şifreyi gir: root123

# Database oluştur
source database.sql
```

Veya SQL dosyasını doğrudan çalıştır:
```bash
mysql -u root -proot123 < database.sql
```

### 4. Node.js Dependencies Yükle

Proje klasöründe PowerShell'i aç:

```bash
cd "C:\Users\barki\Desktop\Magic Power\Yeni klasör (2)"
npm install
```

Bu aşağıdakileri kuracak:
- express
- cors
- mysql2
- bcryptjs
- jsonwebtoken
- dotenv
- vb.

### 5. .env Dosyasını Düzenle

`.env` dosyasını açıp gerekirse değiştir:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root123
DB_NAME=servisdrama
JWT_SECRET=your_secret_key_here
```

### 6. Sunucuyu Başlat

```bash
npm start
```

veya development modunda:

```bash
npm run dev
```

---

## ✅ TEST ET

Tarayıcıda açıt: **http://localhost:3000**

### Test Kullanıcıları:
```
Username: barkin.kayaci
Password: 1452580000
Role: Admin

---

Username: semih.aglan
Password: 1015
Role: Technician

---

Username: suleyman
Password: 1016
Role: Technician
```

---

## 📁 Proje Yapısı

```
/
├── server.js              # Main Express app
├── package.json           # Dependencies
├── .env                   # Configuration
├── database.sql           # Database schema
├── index.html             # Login page
├── admin.html             # Dashboard
├── public/
│   └── api.js             # API client
├── routes/
│   ├── auth.js            # Login/Register
│   ├── data.js            # Device data CRUD
│   └── backup.js          # Backup/Export
├── config/
│   └── database.js        # DB connection
└── middleware/
    └── auth.js            # JWT verification
```

---

## 🔌 API Endpoints

### Auth
- `POST /api/auth/login` - Giriş
- `POST /api/auth/register` - Kayıt
- `GET /api/auth/verify` - Token kontrol

### Data
- `GET /api/data` - Tüm verileri getir
- `GET /api/data/:id` - Belirli ID'deki veriyi getir
- `POST /api/data` - Yeni veri kaydet
- `PUT /api/data/:id` - Veriyi güncelle
- `DELETE /api/data/:id` - Veriyi sil

### Backup/Export
- `GET /api/backup/export/json` - JSON olarak indir
- `GET /api/backup/export/csv` - CSV olarak indir
- `GET /api/backup/export/sql` - SQL dump olarak indir
- `GET /api/backup/stats` - İstatistikler
- `POST /api/backup/create` - Backup oluştur

---

## 🌐 Oracle Free Tier'a Deploy

### 1. VM Instance Oluştur

Oracle Cloud Console → Compute → Instances → Create Instance

**Önerilen Ayarlar:**
- Image: Ubuntu 22.04
- Shape: Ampere (Free tier)
- SSH Key: Yeni key pair oluştur

### 2. VM'ye Bağlan

```bash
ssh -i your-key.key ubuntu@your-oracle-ip
```

### 3. Node.js Kur

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4. MySQL Kur

```bash
sudo apt-get update
sudo apt-get install -y mysql-server
sudo mysql_secure_installation
```

### 5. Projeyi Upload Et

```bash
# Local'den Oracle VM'e
scp -i your-key.key -r "C:\Users\barki\Desktop\Magic Power\Yeni klasör (2)/*" ubuntu@your-oracle-ip:~/servisdrama/
```

### 6. VM'de Çalıştır

```bash
cd ~/servisdrama
npm install
npm start
```

### 7. Firewall Kuralı Ekle

Oracle Cloud → Virtual Cloud Networks → Security Lists → Egress/Ingress Rules

**Ingress Rule Ekle:**
- Protocol: TCP
- Source CIDR: 0.0.0.0/0
- Destination Port: 3000

---

## 🔐 Güvenlik İpuçları

1. **JWT_SECRET'ı değiştir** - `.env`'de güçlü bir key set et
2. **HTTPS kullan** - Production'da SSL sertifikası ekle
3. **Rate limiting** - Zaten ekli, gerekirse `.env`'de artır
4. **Database backup** - Düzenli backup al
5. **Güçlü şifre** - Tüm users için güçlü şifre set et

---

## ❓ Troubleshooting

**Port 3000 kullanımda?**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

**MySQL bağlantı hatası?**
- MySQL servisinin çalışıyor mu kontrol et
- `.env`'deki DB ayarlarını doğrula
- `mysql -u root -p` ile manuel bağlan

**npm install hatası?**
```bash
npm cache clean --force
npm install
```

---

## 📞 Destek

Sorunlar için GitHub issues açabilir veya local support team'e iletişime geçebilirsin.

**Happy coding! 🚀**

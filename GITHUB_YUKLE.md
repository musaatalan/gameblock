# GitHub'a Yükleme

Bu projeyi GitHub'da **yeni bir depo** olarak yüklemek için:

## 1. GitHub'da yeni depo oluştur

1. https://github.com/new adresine git.
2. **Repository name:** `blok-patlat` (veya istediğin isim).
3. **Public** seç.
4. **README, .gitignore, license ekleme** — bunları ekleme (zaten projede var).
5. **Create repository** tıkla.

## 2. Projeyi GitHub'a bağla ve gönder

Terminalde (PowerShell veya CMD) proje klasörüne gir:

```bash
cd c:\Users\laptot\Desktop\kombipazarı\blok-patlat
```

GitHub kullanıcı adın `KULLANICI_ADIN` olsun. Aşağıdaki komutlarda onu değiştir:

```bash
git remote add origin https://github.com/KULLANICI_ADIN/blok-patlat.git
git branch -M main
git push -u origin main
```

(GitHub'da depo adını farklı yaptıysan `blok-patlat` yerine onu yaz.)

İlk push’ta GitHub kullanıcı adı ve şifre/token istenebilir. Şifre yerine **Personal Access Token** kullanman gerekebilir (Settings → Developer settings → Personal access tokens).

## Özet

- Proje yolu: `c:\Users\laptot\Desktop\kombipazarı\blok-patlat`
- İlk commit atıldı.
- Sadece GitHub’da yeni depoyu oluşturup `git remote add origin` ve `git push` yapman yeterli.

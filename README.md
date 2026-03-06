# Blok Patlat

Ücretsiz blok puzzle oyunu — renkli blokları 9×9 tahtaya yerleştir, satır veya sütunları doldurup patlat, skorunu yükselt.

![Blok Patlat](https://img.shields.io/badge/oyun-blok%20puzzle-blue) ![Türkçe](https://img.shields.io/badge/dil-T%C3%BCrk%C3%A7e-green)

## Oynatmak (tarayıcı)

1. Bu depoyu klonla veya indir.
2. Kök klasördeki `index.html` dosyasını tarayıcıda aç (çift tıkla veya sürükle-bırak).
3. “Kabul Et” ile başla, alttan bir blok seç, tahtaya tıkla/dokun; gölge nereye yerleşeceğini gösterir.

**Gereksinim:** İnternet (fontlar için). Masaüstü ve mobil tarayıcı desteklenir.

## Android APK derlemek

1. [Node.js](https://nodejs.org/) yüklü olsun.
2. Proje kökünde:
   ```bash
   npm install
   npm run copy-to-www
   npx cap add android
   ```
   (Zaten `android` klasörü varsa `npx cap add android` atlanabilir.)
3. APK için:
   ```bash
   npm run cap:sync
   cd android && ./gradlew assembleRelease
   ```
   APK: `android/app/build/outputs/apk/release/app-release.apk`  
   Google Play için AAB: `./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`

Release imzalama için `android/` içinde kendi keystore ve `keystore.properties` tanımlanmalı (örnek: `keystore.properties.example`).

## Özellikler

- 9×9 tahta, çoklu blok şekilleri (tek kare, L, T, 3×3 “dev blok” vb.)
- Seviye arttıkça zorlaşan blok dağılımı
- Satır/sütun temizleme, kombo metinleri, parçacık efektleri
- Yerleştirme gölgesi (geçerli/geçersiz konum)
- En yüksek skor (tarayıcıda yerel saklama)
- Ses efektleri, ayarlar paneli, tema seçeneği
- Türkçe arayüz

## Teknolojiler

- Vanilla JS, HTML5, CSS3, Canvas API  
- Mobil: Capacitor, Android (APK/AAB)

## Lisans

Bu proje eğitim ve kişisel kullanım içindir. İstersen kendi projende kullanabilirsin.

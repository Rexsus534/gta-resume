# Vice City Stories

Three.js ve Vite ile hazırlanmış, tarayıcıda çalışan 3D açık dünya şehir oyunu.

## Çalıştırma

```bash
npm install
npm run dev
```

## Kontroller

| Tuş | İşlev |
| --- | --- |
| WASD / yön tuşları | Yürüme ve araç kullanma |
| Shift | Koşma |
| F | Yakındaki araca binme / araçtan inme |
| E | Görev alma ve teslimatı tamamlama |
| K | Oyunu kaydetme |

Mobil ekranda sol taraftaki yön tuşları ve sağ taraftaki F / E düğmeleri kullanılabilir.

## Oyun özellikleri

- Üçüncü şahıs kamera ve 3D karakter modeli.
- Sahil, plaj, palmiye ağaçları, park, liman, yollar ve çok katlı binalardan oluşan şehir.
- Yürüyen 3D yayalar ve şehirde kullanılabilen araçlar.
- Araçlara binme, inme, hızlanma, geri gitme ve direksiyon kontrolü.
- Teslimat görevi, mini harita, para ödülü ve yerel kayıt.
- Masaüstü ve mobil ekranlara uyumlu arayüz.

Şehir, binalar, yayalar ve araçlar Three.js geometrileriyle oluşturulur. Karakter için `public/models/` içindeki GLB model ve animasyon dosyaları kullanılır.

## Teknoloji

- Three.js
- Vite
- JavaScript
- GLTFLoader

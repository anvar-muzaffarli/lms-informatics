# İnformatika — tədris platforması

Tələbələr PDF materialları oxuyur və test işləyir, müəllim hər şeyi statistikada izləyir.
Sistem tam pulsuzdur: **Netlify** (sayt) + **Supabase** (verilənlər bazası, giriş, fayllar).

## İmkanlar

**Tələbə**
- Login və şifrə ilə giriş (e-poçt lazım deyil)
- Yalnız öz qrupuna təyin edilmiş PDF-ləri və testləri görür
- PDF sayt daxilində açılır: üzərində tələbənin adı ilə su nişanı, son oxunan səhifədən davam
- Test: taymer, sualların və variantların qarışdırılması, cavablar avtomatik saxlanılır (internet kəsilsə də itmir)
- Bitirdikdən sonra bal, düzgün cavablar və izahlar (müəllim icazə veribsə)

**Admin (müəllim)**
- Tələbə hesablarını Excel-dən toplu yaratmaq; şifrələr avtomatik yaradılır və Excel kimi yüklənir
- Qruplar, şifrə yeniləmə, tələbə silmə
- PDF yükləmək və qruplara təyin etmək
- Sualları Excel-dən yükləmək, əl ilə əlavə etmək və ya redaktə etmək, Excel-ə ixrac etmək
- Test ayarları: vaxt limiti, cəhd sayı, sual bankından təsadüfi N sual, açılma/bağlanma tarixi
- **Statistika:**
  - İdarə paneli: 14 günlük aktivlik, testlər və qruplar üzrə müqayisə, ən yaxşı tələbələr, heç aktivliyi olmayanlar
  - Material üzrə: kim açıb, neçə səhifə oxuyub, neçə dəqiqə vaxt sərf edib, kim heç açmayıb
  - Test üzrə: balların paylanması, median, işləməyənlər, **ən çox səhv edilən suallar** və ən çox seçilən səhv variant
  - Tələbə üzrə: bütün testləri və materialları bir səhifədə
  - Test zamanı başqa tab-a keçid sayı (köçürmə şübhəsi)
  - Bütün cədvəllər Excel-ə ixrac olunur

**Təhlükəsizlik:** düzgün cavablar brauzerə heç vaxt göndərilmir, qiymətləndirmə serverdə aparılır.
Tələbə başqa qrupun materialını və ya testini aça bilməz, nəticəni də dəyişə bilməz (Supabase RLS).

---

## Quraşdırma (təxminən 20 dəqiqə)

### 1. Supabase
1. https://supabase.com saytında pulsuz hesab açın, sonra **New project** yaradın (region: Frankfurt).
2. **SQL Editor → New query** bölməsini açın, `supabase/schema.sql` faylının hamısını yapışdırıb **Run** basın.
3. **Authentication → Sign In / Providers → Email** bölməsində **Confirm email** seçimini SÖNDÜRÜN.
   Həmin yerdə **Allow new users to sign up** seçimini də söndürün (hesabları yalnız admin yaradır).
4. **Project Settings → API** bölməsindən bu üç dəyəri götürün:
   - `Project URL`
   - `anon public` açarı
   - `service_role` açarı (gizli saxlayın!)

### 2. Admin hesabı
1. **Authentication → Users → Add user → Create new user** bölməsinə keçin.
   E-poçt: `admin@telebe.oyu.az`, şifrə istədiyiniz kimi olsun. **Auto Confirm User** seçimini işarələyin.
2. SQL Editor-da bu sorğunu işlədin:
   ```sql
   insert into public.profiles (id, full_name, login, role)
   select id, 'Ənvər Mizanfarlı', 'admin', 'admin' from auth.users where email = 'admin@telebe.oyu.az';
   ```
3. Saytda login olaraq `admin` yazıb daxil olacaqsınız.

### 3. Netlify
1. Layihəni GitHub-a yükləyin (`.env` faylı yüklənmir).
2. Netlify-da **Add new site → Import from Git** ilə repozitoriyanı seçin. Build ayarları `netlify.toml` faylından avtomatik götürülür.
3. **Site configuration → Environment variables** bölməsinə bu dəyişənləri əlavə edin:

   | Ad | Dəyər |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon açarı |
   | `VITE_LOGIN_DOMAIN` | `telebe.oyu.az` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role açarı |

4. **Deploys → Trigger deploy** basın. Bu qədər.

> `service_role` açarı yalnız `netlify/functions/admin-users.mts` funksiyasında istifadə olunur və brauzerə getmir.
> `VITE_LOGIN_DOMAIN` dəyərini sonradan dəyişməyin, çünki köhnə hesablar daxil ola bilməz.

### Kompüterdə işlətmək
```bash
npm install
cp .env.example .env      # dəyərləri doldurun
npm install -g netlify-cli
netlify dev               # http://localhost:8888 — tələbə yaratma funksiyası da işləyir
```
Sadəcə `npm run dev` da işləyir, amma onda tələbə hesabı yaratmaq mümkün olmur (Netlify funksiyası lazımdır).

---

## Excel formatları

**Suallar** (`samples/informatika-suallar-nümunə.xlsx`, 18 hazır sual):

| Sual | A | B | C | D | E | Düzgün | İzah | Mövzu |
|---|---|---|---|---|---|---|---|---|
| 1 bayt neçə bitdir? | 4 | 8 | 16 | 32 | | B | 1 bayt = 8 bit | İnformasiyanın ölçülməsi |

- 2-dən 6-ya qədər variant (A–F) yazmaq olar; boş sütunlar nəzərə alınmır.
- `Düzgün` sütununa hərf (A–F) və ya rəqəm (1–6) yazılır.
- `İzah` və `Mövzu` sütunları könüllüdür.

**Tələbələr** (`samples/tələbələr-nümunə.xlsx`):

| Ad Soyad | Login | Şifrə | Qrup |
|---|---|---|---|
| Əli Məmmədov | ali.mammadov | | 758 TH |

Login boş qalsa addan yaradılır (`ali.mammadov`). Şifrə boş qalsa 8 simvolluq təsadüfi şifrə verilir.
Olmayan qrup avtomatik yaradılır. Nəticədə bütün giriş məlumatları Excel faylı kimi yüklənir.

---

## Pulsuz plan limitləri
- **Supabase:** 500 MB baza, 1 GB fayl (təxminən 200–400 PDF), 50 000 aktiv istifadəçi.
  7 gün heç kim daxil olmasa layihə "yuxu" rejiminə keçir və Dashboard-dan bir kliklə oyanır. Semestr ərzində bu baş vermir.
- **Netlify:** ayda 100 GB trafik və 125 000 funksiya çağırışı. Bir neçə yüz tələbə üçün kifayətdir.

## Struktur
```
supabase/schema.sql              cədvəllər, RLS qaydaları, test funksiyaları
netlify/functions/admin-users.mts  tələbə hesablarının yaradılması
src/pages/student/               tələbə səhifələri
src/pages/admin/                 admin səhifələri
samples/                         nümunə Excel faylları
```

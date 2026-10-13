-- Wolves Brotherhood MC — D1 shēma
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'rider', pass TEXT NOT NULL, salt TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, role TEXT NOT NULL, created_by TEXT, used_by TEXT, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, cat TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, created INTEGER NOT NULL, last_at INTEGER NOT NULL, solved INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS threads_cat ON threads(cat, last_at DESC);
CREATE INDEX IF NOT EXISTS threads_last ON threads(last_at DESC);
CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, thread TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS posts_thread ON posts(thread, created);
CREATE TABLE IF NOT EXISTS likes (post TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY (post, user));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS messages_room ON messages(room, created DESC);
CREATE TABLE IF NOT EXISTS sos (id TEXT PRIMARY KEY, kind TEXT NOT NULL, note TEXT, phone TEXT, lat REAL NOT NULL, lon REAL NOT NULL, author TEXT NOT NULL, created INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sos_resp (sos TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY (sos, user));
CREATE TABLE IF NOT EXISTS hazards (id TEXT PRIMARY KEY, kind TEXT NOT NULL, note TEXT, lat REAL NOT NULL, lon REAL NOT NULL, by_user TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS hazards_created ON hazards(created DESC);
CREATE TABLE IF NOT EXISTS helpers (user_id TEXT PRIMARY KEY, city TEXT, offers TEXT, note TEXT, contact TEXT, lat REAL, lon REAL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate (k TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, win));

-- Sākuma saturs forumam (izpildās droši atkārtoti)
INSERT OR IGNORE INTO users (id, email, name, role, pass, salt, created) VALUES ('wbmc-system', 'system@wolvesbrotherhoodmc.com', 'Wolves Brotherhood MC', 'officer', '!', '00', 1791900000000);
INSERT OR IGNORE INTO threads (id, cat, title, author, created, last_at, solved, replies) VALUES
 ('welcome', 'general', 'Laipni lūgti Riders Help Riders', 'wbmc-system', 1791900000000, 1791900000000, 0, 0),
 ('how-sos', 'roadhelp', 'Kā darbojas SOS un ceļa brīdinājumi', 'wbmc-system', 1791900001000, 1791900001000, 0, 0);
INSERT OR IGNORE INTO posts (id, thread, author, body, created) VALUES
 ('welcome-1', 'welcome', 'wbmc-system', 'Šī ir vieta, kur braucēji palīdz braucējiem — neatkarīgi no kluba vai motocikla.

Forumā jautā par tehniku, maršrutiem, ekipējumu un dalies ar pieredzi. Lasīt var visi, rakstīt — reģistrēti braucēji. Kluba biedri ar ielūguma kodu redz arī kluba čatus.

Noteikumi vienkārši: cieņa, bez reklāmas, bez politikas. Palīdzi, kad vari — nākamreiz palīdzēs tev.', 1791900000000),
 ('how-sos-1', 'how-sos', 'wbmc-system', 'SOS dēlis — ja esi uz ceļa un vajag palīdzību (riepa, akumulators, degviela), nospied "Lūgt palīdzību". Tava atrašanās vieta parādīsies kartē, un tuvākie braucēji var atsaukties ar "Braucu palīgā".

Ja kāds ir cietis — vispirms zvani 112.

Ceļa brīdinājumi — ziņo par granti, bedrēm, eļļu vai remontdarbiem. Brīdinājumi redzami arī Ride HQ kartē un pazūd pēc 7 dienām.', 1791900001000);

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

-- Šaha galds: partijas un kluba reitings (Elo)
CREATE TABLE IF NOT EXISTS chess_games (id TEXT PRIMARY KEY, white TEXT, black TEXT, creator TEXT NOT NULL, tc_base INTEGER NOT NULL, tc_inc INTEGER NOT NULL, rated INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL, result TEXT, reason TEXT, moves TEXT, created INTEGER NOT NULL, ended INTEGER, w_elo INTEGER, b_elo INTEGER, w_diff INTEGER, b_diff INTEGER);
CREATE INDEX IF NOT EXISTS chess_status ON chess_games(status, created DESC);
CREATE INDEX IF NOT EXISTS chess_ended ON chess_games(ended DESC);
CREATE TABLE IF NOT EXISTS chess_ratings (user_id TEXT PRIMARY KEY, elo INTEGER NOT NULL DEFAULT 1200, best INTEGER NOT NULL DEFAULT 1200, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, updated INTEGER);

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

-- Satura pārvaldība (administrācijas panelis): pārrakstījumi, vēsture, faili, darbību žurnāls
CREATE TABLE IF NOT EXISTS cms (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL, by_name TEXT);
CREATE TABLE IF NOT EXISTS cms_history (id TEXT PRIMARY KEY, key TEXT NOT NULL, value TEXT, at INTEGER NOT NULL, by_name TEXT);
CREATE INDEX IF NOT EXISTS cms_history_key ON cms_history(key, at DESC);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, type TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created INTEGER NOT NULL, by_name TEXT);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, at INTEGER NOT NULL, user_id TEXT, user_name TEXT, action TEXT NOT NULL, target TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS audit_at ON audit(at DESC);

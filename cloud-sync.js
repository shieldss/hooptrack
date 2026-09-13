import { firebaseConfigured, getFirebaseServices } from './firebase-config.js';

const CLOUD_SCHEMA_VERSION = 1;
const SYNC_DELAY = 20000;
let services, user, hooks, syncTimer, syncing = false, pending = false;
let lastHashes = new Map();

const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail }));
const clone = value => JSON.parse(JSON.stringify(value));
const stamp = value => +value?.updatedAt || +value?.deletedAt || +value?.createdAt || 0;
const hash = value => JSON.stringify(value);
const safeId = value => encodeURIComponent(String(value || 'unassigned')).replace(/%/g, '_');
const dirtyKey = uid => `hooptrack-cloud-dirty-${uid}`;

function withoutPhotos(value) {
  const data = clone(value);
  delete data.playerPhoto;
  if (Array.isArray(data.games)) data.games.forEach(game => delete game.playerPhoto);
  return data;
}

function meaningful(state) {
  return !!(state.playerName || state.games?.length || state.seasonName || state.leagueName || state.teamName);
}

function status(state, message = '') { emit('hooptrack-cloud-status', { state, message, user }); }

function schedule() {
  if (!user || !pending) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => flush(), SYNC_DELAY);
  status(navigator.onLine ? 'saving' : 'offline');
}

function seedLocalHashes(state) {
  const clean = withoutPhotos(state);
  lastHashes.set('profile', hash({ playerName: clean.playerName, jerseyNumber: clean.jerseyNumber, seasonName: clean.seasonName, leagueName: clean.leagueName, teamName: clean.teamName }));
  lastHashes.set('settings', hash({ settings: clean.settings }));
  for (const game of clean.games || []) lastHashes.set(`game:${game.id}`, hash({ ...game, id: game.id, createdAt: game.createdAt || 0, updatedAt: game.updatedAt || 0, deleted: false }));
  for (const tombstone of clean.deletedGames || []) lastHashes.set(`game:${tombstone.id}`, hash({ id: tombstone.id, deleted: true, deletedAt: tombstone.deletedAt || 0, updatedAt: tombstone.deletedAt || 0 }));
  const leagues = new Map((clean.games || []).map(game => [`${game.seasonName}|${game.leagueName}`, { season: game.seasonName, name: game.leagueName, team: game.teamName }]));
  for (const [key, league] of leagues) { const data = { ...league, id: safeId(key) }; lastHashes.set(`league:${data.id}`, hash(data)); }
}

async function readCloudState(uid) {
  const { firestoreSdk: f, db } = services;
  const userRef = f.doc(db, 'users', uid);
  const [userSnap, playerSnap, settingsSnap, gamesSnap] = await Promise.all([
    f.getDoc(userRef),
    f.getDoc(f.doc(db, 'users', uid, 'players', 'default')),
    f.getDoc(f.doc(db, 'users', uid, 'settings', 'app')),
    f.getDocs(f.collection(db, 'users', uid, 'games'))
  ]);
  return {
    root: userSnap.exists() ? userSnap.data() : null,
    profile: playerSnap.exists() ? playerSnap.data() : null,
    settings: settingsSnap.exists() ? settingsSnap.data() : null,
    games: gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
}

function mergeState(local, remote) {
  const next = clone(local);
  const localStateStamp = +local.updatedAt || 0;
  const remoteStamp = Math.max(stamp(remote.profile), stamp(remote.settings));
  if (remoteStamp > localStateStamp) {
    Object.assign(next, withoutPhotos(remote.profile || {}));
    next.settings = { ...next.settings, ...(remote.settings?.settings || {}) };
    next.updatedAt = remoteStamp;
  }
  const localGames = new Map(next.games.map(game => [game.id, game]));
  const tombstones = new Map((next.deletedGames || []).map(item => [item.id, item]));
  for (const remoteGame of remote.games) {
    const localGame = localGames.get(remoteGame.id);
    const tombstone = tombstones.get(remoteGame.id);
    if (remoteGame.deleted) {
      if (!tombstone || stamp(remoteGame) >= stamp(tombstone)) {
        localGames.delete(remoteGame.id);
        tombstones.set(remoteGame.id, { id: remoteGame.id, deletedAt: remoteGame.deletedAt || Date.now() });
      }
    } else if (!tombstone && (!localGame || stamp(remoteGame) > stamp(localGame))) {
      localGames.set(remoteGame.id, { ...remoteGame, playerPhoto: localGame?.playerPhoto || '' });
    }
  }
  next.games = [...localGames.values()];
  next.deletedGames = [...tombstones.values()];
  return next;
}

async function writeChanged(state) {
  const { firestoreSdk: f, db } = services;
  const now = Date.now();
  const userPath = ['users', user.uid];
  const clean = withoutPhotos(state);
  const profile = { playerName: clean.playerName, jerseyNumber: clean.jerseyNumber, seasonName: clean.seasonName, leagueName: clean.leagueName, teamName: clean.teamName };
  const settings = { settings: clean.settings };
  const profileHash = hash(profile), settingsHash = hash(settings);
  const batch = f.writeBatch(db);
  let writes = 0;
  const set = (ref, data) => { batch.set(ref, data, { merge: true }); writes++; };
  if (lastHashes.get('profile') !== profileHash) { set(f.doc(db, ...userPath, 'players', 'default'), { ...profile, updatedAt: now }); lastHashes.set('profile', profileHash); }
  if (lastHashes.get('settings') !== settingsHash) { set(f.doc(db, ...userPath, 'settings', 'app'), { ...settings, updatedAt: now }); lastHashes.set('settings', settingsHash); }
  for (const game of clean.games || []) {
    const data = { ...game, id: game.id, createdAt: game.createdAt || now, updatedAt: game.updatedAt || now, deleted: false };
    const key = `game:${game.id}`, value = hash(data);
    if (lastHashes.get(key) !== value) { set(f.doc(db, ...userPath, 'games', game.id), data); lastHashes.set(key, value); }
  }
  for (const tombstone of clean.deletedGames || []) {
    const data = { id: tombstone.id, deleted: true, deletedAt: tombstone.deletedAt || now, updatedAt: tombstone.deletedAt || now };
    const key = `game:${tombstone.id}`, value = hash(data);
    if (lastHashes.get(key) !== value) { set(f.doc(db, ...userPath, 'games', tombstone.id), data); lastHashes.set(key, value); }
  }
  const leagues = new Map((clean.games || []).map(game => [`${game.seasonName}|${game.leagueName}`, { season: game.seasonName, name: game.leagueName, team: game.teamName }]));
  for (const [key, league] of leagues) {
    const data = { ...league, id: safeId(key) };
    const cacheKey = `league:${data.id}`, value = hash(data);
    if (lastHashes.get(cacheKey) !== value) { set(f.doc(db, ...userPath, 'leagues', data.id), { ...data, updatedAt: now }); lastHashes.set(cacheKey, value); }
  }
  if (writes) await batch.commit();
}

async function flush() {
  if (!user || !pending || syncing || !navigator.onLine) return;
  syncing = true;
  status('saving');
  try {
    const state = hooks.getState();
    await writeChanged(state);
    pending = false;
    localStorage.removeItem(dirtyKey(user.uid));
    status('synced');
  } catch (error) {
    pending = true;
    status('error', 'Changes remain safely on this device and will retry.');
    schedule();
  } finally { syncing = false; }
}

function hasLocalOnlyChanges(local, remote) {
  const remoteGames = new Map(remote.games.map(game => [game.id, game]));
  return (local.games || []).some(game => !remoteGames.has(game.id)) || (local.deletedGames || []).some(item => !remoteGames.has(item.id));
}

async function handleUser(nextUser) {
  user = nextUser || null;
  lastHashes = new Map();
  if (!user) { status('offline'); emit('hooptrack-cloud-account', { user: null }); return; }
  try {
    status('saving');
    const remote = await readCloudState(user.uid);
    const local = hooks.getState();
    if (!remote.root) {
      const { firestoreSdk: f, db } = services;
      await f.setDoc(f.doc(db, 'users', user.uid), {
        displayName: user.displayName || '', email: user.email || '', photoURL: user.photoURL || '', createdAt: f.serverTimestamp(), updatedAt: f.serverTimestamp(), schemaVersion: CLOUD_SCHEMA_VERSION, migrationVersion: 0
      }, { merge: true });
    }
    emit('hooptrack-cloud-account', { user });
    if (!remote.root?.migrationVersion && meaningful(local)) {
      emit('hooptrack-cloud-migration', { counts: { players: local.playerName ? 1 : 0, leagues: new Set((local.games || []).map(game => `${game.seasonName}|${game.leagueName}`)).size, games: local.games?.length || 0 } });
      status('synced', 'Choose how to handle the data already on this device.');
      return;
    }
    if (!remote.root?.migrationVersion && !meaningful(local)) await completeMigration('fresh');
    const localOnlyChanges = hasLocalOnlyChanges(local, remote);
    const merged = mergeState(local, remote);
    hooks.replaceState(merged);
    hooks.saveLocal();
    hooks.renderAll();
    pending = localStorage.getItem(dirtyKey(user.uid)) === '1' || localOnlyChanges;
    if (pending) await flush(); else status('synced');
  } catch (error) { status(navigator.onLine ? 'error' : 'offline', 'Cloud sync is unavailable. Local tracking is still active.'); }
}

async function completeMigration(choice) {
  if (!user) return;
  try {
    if (choice === 'import') { pending = true; localStorage.setItem(dirtyKey(user.uid), '1'); await flush(); }
    else seedLocalHashes(hooks.getState());
    const { firestoreSdk: f, db } = services;
    await f.setDoc(f.doc(db, 'users', user.uid), { migrationVersion: CLOUD_SCHEMA_VERSION, updatedAt: f.serverTimestamp() }, { merge: true });
    status('synced');
  } catch { status('error', 'Migration could not finish. Your local data is still safe.'); }
}

async function startSignIn() {
  if (!firebaseConfigured()) { status('error', 'Add your Firebase web configuration in firebase-config.js first.'); return; }
  try {
    services ||= await getFirebaseServices();
    const { auth, authSdk } = services;
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    const provider = new authSdk.GoogleAuthProvider();
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (installed) await authSdk.signInWithRedirect(auth, provider);
    else {
      try { await authSdk.signInWithPopup(auth, provider); }
      catch (error) { if (error.code === 'auth/popup-blocked') await authSdk.signInWithRedirect(auth, provider); else throw error; }
    }
  } catch (error) {
    if (error.code === 'auth/unauthorized-domain') status('error', 'Google sign-in needs shieldss.github.io added in Firebase Authorized domains.');
    else if (error.code === 'auth/operation-not-allowed') status('error', 'Enable Google in Firebase Authentication before signing in.');
    else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') status('error', 'Google sign-in could not be completed. Please try again.');
  }
}

async function signOut() { if (!services) return; await services.authSdk.signOut(services.auth); }

async function init(nextHooks) {
  hooks = nextHooks;
  if (!firebaseConfigured()) { status('offline', 'Cloud sync is ready once Firebase is configured.'); return; }
  try {
    services = await getFirebaseServices();
    await services.authSdk.getRedirectResult(services.auth);
    services.authSdk.onAuthStateChanged(services.auth, handleUser);
    addEventListener('online', () => { if (user) { pending = true; flush(); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  } catch { status('error', 'Cloud sync could not start. Local tracking is still active.'); }
}

window.HoopTrackCloud = { init, signIn: startSignIn, signOut, completeMigration, notifyLocalSave: () => { if (user) { pending = true; localStorage.setItem(dirtyKey(user.uid), '1'); schedule(); } }, flush, configured: firebaseConfigured };
emit('hooptrack-cloud-ready');

class EventStore {
  constructor() {
    this._listeners = {};

    // Core game state (formerly the AS global object)
    this.hs = 0;
    this.as = 0;
    this.curTeam = 'home';
    this.home_lineup = [];
    this.away_lineup = [];
    this.batter = null;
    this.abs = [];
    this.pt = null;
    this.zone = null;
    this.rbi = 0;
    this.pending = null;
    this.zoneHistory = {};
    this.balls = 0;
    this.strikes = 0;
    this.outs = 0;
    this.batterFilter = false;
    this.teamFilter = null;
    this.showHotCold = false;
    this.currentPitches = [];
    this.zoneX = null;
    this.zoneY = null;
    this.advFilter = null;
    this.pitchers = [];
    this.currentPitcher = null;
    this.pitcherZone = null;
    this.pitcherPt = null;
    this.pitcherRole = null;
    this.pitchLog = [];
    this.recFilterBid = null;
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (list) this._listeners[event] = list.filter(f => f !== fn);
  }

  emit(event, data) {
    const list = this._listeners[event];
    if (list) list.forEach(fn => { try { fn(data); } catch(e) { console.error('[Store]', event, e); } });
  }

  reset() {
    this.hs = 0; this.as = 0; this.curTeam = 'home';
    this.home_lineup = []; this.away_lineup = [];
    this.batter = null; this.abs = []; this.pt = null;
    this.zone = null; this.rbi = 0; this.pending = null;
    this.zoneHistory = {}; this.balls = 0; this.strikes = 0; this.outs = 0;
    this.batterFilter = false; this.teamFilter = null; this.showHotCold = false;
    this.currentPitches = []; this.zoneX = null; this.zoneY = null;
    this.advFilter = null;
    this.pitchers = []; this.currentPitcher = null;
    this.pitcherZone = null; this.pitcherPt = null; this.pitcherRole = null;
    this.pitchLog = []; this.recFilterBid = null;
    this.emit('reset');
  }
}

// Singleton
export const AS = new EventStore();

// Game Flow state
export const GF = {
  active: false,
  inning: 1,
  half: 'top',
  outs: 0,
  batterIdx: 0,
  bases: [false, false, false]
};

// For backwards compatibility, also expose on window
if (typeof window !== 'undefined') {
  window.AS = AS;
  window.GF = GF;
}

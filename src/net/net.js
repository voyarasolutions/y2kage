// Online co-op over WebRTC. One player hosts: their game runs the level and streams snapshots;
// guests send their own movement and actions. PeerJS's free public broker introduces players by
// room code, then everything flows peer to peer (with PeerJS's TURN relay as a fallback).
import Peer from 'peerjs';

const PREFIX = 'y2kage16-room-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 4;

// ?peer=host:port points at a self-hosted PeerJS server instead of the public one (used for tests).
function peerOptions() {
  const o = { debug: 0 };
  const custom = new URLSearchParams(location.search).get('peer');
  if (custom) {
    const [host, port] = custom.split(':');
    Object.assign(o, { host, port: Number(port) || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost' });
  }
  return o;
}

function roomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}

export class Net {
  constructor(handlers) {
    this.h = handlers;
    this.role = null;
    this.peer = null;
    this.code = null;
    // Host: one entry per guest, in join order. Guest: the connection to the host.
    this.guests = [];
    this.conn = null;
  }

  get active() {
    return !!this.role;
  }

  // Host a room. Resolves with the room code once the broker has registered it.
  host(tries = 3) {
    this.leave();
    return new Promise((resolve, reject) => {
      const code = roomCode();
      const peer = new Peer(PREFIX + code, peerOptions());
      this.peer = peer;
      peer.on('open', () => {
        this.role = 'host';
        this.code = code;
        resolve(code);
      });
      peer.on('connection', (conn) => this.accept(conn));
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id' && tries > 0) {
          peer.destroy();
          this.host(tries - 1).then(resolve, reject);
        } else if (!this.role) {
          reject(explain(e));
          this.leave();
        } else this.h.error?.(explain(e));
      });
      peer.on('disconnected', () => {
        // Lost the broker, but existing peer links still work; try to re-register quietly.
        try {
          peer.reconnect();
        } catch (e) {}
      });
    });
  }

  accept(conn) {
    conn.on('open', () => {
      if (this.guests.length + 1 >= MAX_PLAYERS || this.h.locked?.()) {
        conn.send({ t: 'full' });
        setTimeout(() => conn.close(), 300);
        return;
      }
      const g = { conn, id: conn.peer, info: null };
      this.guests.push(g);
      conn.on('data', (m) => this.h.fromGuest(g, m));
      conn.on('close', () => this.drop(g));
      conn.on('error', () => this.drop(g));
    });
  }

  drop(g) {
    const i = this.guests.indexOf(g);
    if (i < 0) return;
    this.guests.splice(i, 1);
    this.h.guestLeft(g);
  }

  // Join a room by code. Resolves when connected to the host.
  join(code) {
    this.leave();
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return new Promise((resolve, reject) => {
      const peer = new Peer(undefined, peerOptions());
      this.peer = peer;
      let done = false;
      const fail = (msg) => {
        if (done) return;
        done = true;
        this.leave();
        reject(msg);
      };
      const timer = setTimeout(() => fail('No answer from that room. Check the code?'), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          clearTimeout(timer);
          done = true;
          this.role = 'guest';
          this.code = code;
          this.conn = conn;
          resolve(code);
        });
        conn.on('data', (m) => this.h.fromHost(m));
        conn.on('close', () => this.lost());
        conn.on('error', () => this.lost());
      });
      peer.on('error', (e) => {
        clearTimeout(timer);
        if (!done) fail(explain(e));
        else if (e.type !== 'peer-unavailable') this.h.error?.(explain(e));
      });
    });
  }

  lost() {
    if (this.role !== 'guest') return;
    this.leave();
    this.h.hostLeft();
  }

  // Host: send to every guest (or one). Guest: send to the host.
  send(m, g) {
    if (this.role === 'host') {
      for (const x of g ? [g] : this.guests) if (x.conn.open) x.conn.send(m);
    } else if (this.conn?.open) this.conn.send(m);
  }

  leave() {
    const peer = this.peer;
    this.role = null;
    this.code = null;
    this.guests = [];
    this.conn = null;
    this.peer = null;
    if (peer) {
      try {
        peer.destroy();
      } catch (e) {}
    }
  }
}

function explain(e) {
  const t = e?.type;
  if (t === 'peer-unavailable') return 'Room not found. Check the code?';
  if (t === 'browser-incompatible') return 'This browser cannot do online play.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the matchmaking server.';
  if (t === 'webrtc') return 'Could not open a connection to that player.';
  return 'Connection failed.';
}

// /static/js/EventManager.js

export class EventManager {
    constructor() {
      this.events = {};
    }
  
    subscribe(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      this.events[eventName].push(callback);
    }
  
    unsubscribe(eventName, callback) {
      if (!this.events[eventName]) return;
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }
  
    notify(eventName, data) {
      if (!this.events[eventName]) return;
      this.events[eventName].forEach(callback => callback(data));
    }
  }
  
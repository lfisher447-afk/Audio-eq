"use strict";

const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

module.exports = {
  // Bandpass
  bandpass: function(freq, q) {
    freq = clamp(freq, 1e-6, 1);
    q    = clamp(q, 1e-4, 1000);
    var w0 = 2 * Math.PI * freq;
    var sn = 0.5 * Math.sqrt((4 - Math.sqrt(16 - 16 / Math.pow(10, q / 10))) / 2) * Math.sin(w0);
    var beta  = 0.5 * (1 - sn) / (1 + sn);
    var gamma = (0.5 + beta) * Math.cos(w0);
    var alpha = 0.25 * (0.5 + beta - gamma);
    return[ 2 * alpha, 4 * alpha, 2 * alpha, 2 * -gamma, 2 * beta ];
  },

  // Peaking
  peaking: function(freq, q, gain) {
    freq = clamp(freq, 1e-6, 1);
    q    = clamp(q, 1e-4, 1000);
    gain = clamp(gain, -40, 40);
    var w0 = 2 * Math.PI * freq, sin = Math.sin(w0), cos = Math.cos(w0);
    var a = Math.pow(10, (gain / 40)), alpha = sin / (2 * q);
    var a0 = 1 + alpha / a;
    return[ (1 + alpha * a)/a0, (-2 * cos)/a0, (1 - alpha * a)/a0, (-2 * cos)/a0, (1 - alpha / a)/a0 ];
  },

  // Notch
  notch: function(freq, q) {
    freq = clamp(freq, 1e-6, 1);
    q    = clamp(q, 1e-4, 1000);
    var w0 = 2 * Math.PI * freq, sin = Math.sin(w0), cos = Math.cos(w0), alpha = sin / (2 * q);
    var a0 = 1 + alpha;
    return[ 1/a0, (-2 * cos)/a0, 1/a0, (-2 * cos)/a0, (1 - alpha)/a0 ];
  },

  // Allpass
  allpass: function(freq, q) {
    freq = clamp(freq, 1e-6, 1);
    q    = clamp(q, 1e-4, 1000);
    var w0 = 2 * Math.PI * freq, sin = Math.sin(w0), cos = Math.cos(w0), alpha = sin / (2 * q);
    var a0 = 1 + alpha;
    return[ (1 - alpha)/a0, (-2 * cos)/a0, (1 + alpha)/a0, (-2 * cos)/a0, (1 - alpha)/a0 ];
  },

  // Lowshelf
  lowshelf: function(freq, _, gain) {
    freq = clamp(freq, 1e-6, 1);
    gain = clamp(gain, -40, 40);
    var w0 = 2 * Math.PI * freq, sin = Math.sin(w0), cos = Math.cos(w0);
    var a = Math.pow(10, (gain / 40)), alphamod = 2 * Math.sqrt(a) * ((sin / 2) * Math.sqrt(2));
    var a0 = ((a+1) + (a-1) * cos + alphamod);
    return[ (a * ((a+1) - (a-1) * cos + alphamod))/a0, (2 * a * ((a-1) - (a+1) * cos))/a0, (a * ((a+1) - (a-1) * cos - alphamod))/a0, (-2 * ((a-1) + (a+1) * cos))/a0, ((a+1) + (a-1) * cos - alphamod)/a0 ];
  },

  // Highshelf
  highshelf: function(freq, _, gain) {
    freq = clamp(freq, 1e-6, 1);
    gain = clamp(gain, -40, 40);
    var w0 = 2 * Math.PI * freq, sin = Math.sin(w0), cos = Math.cos(w0);
    var a = Math.pow(10, (gain / 40)), alphamod = 2 * Math.sqrt(a) * ((sin / 2) * Math.sqrt(2));
    var a0 = ((a+1) - (a-1) * cos + alphamod);
    return[ (a * ((a+1) + (a-1) * cos + alphamod))/a0, (-2 * a * ((a-1) + (a+1) * cos))/a0, (a * ((a+1) + (a-1) * cos - alphamod))/a0, (2 * ((a-1) - (a+1) * cos))/a0, ((a+1) - (a-1) * cos - alphamod)/a0 ];
  },

  // Lowpass
  lowpass: function(freq, q) {
    freq = clamp(freq, 1e-6, 1);
    q    = clamp(q, 1e-4, 1000);
    var w0 = 2 * Math.PI * freq;
    var d = Math.sqrt((4 - Math.sqrt(16 - 16 / Math.pow(10, q / 10))) / 2);
    var sn = 0.5 * d * Math.sin(w0);
    var beta  = 0.5 * (1 - sn) / (1 + sn);
    var gamma = (0.5 + beta) * Math.cos(w0);
    var alpha = 0.25 * (0.5 + beta + gamma);
    return[ 2 * alpha, -4 * alpha, 2 * alpha, 2 * -gamma, 2 * beta ];
  },

  // Highpass
  highpass: function(freq, q) {
    freq = clamp(freq, 1e-6, 1);
    q    = clamp(q, 1e-4, 1000);
    var w0 = 2 * Math.PI * freq, sin = Math.sin(w0), cos = Math.cos(w0), alpha = sin / (2 * q);
    var a0 = 1 + alpha;
    return[ alpha/a0, 0, -alpha/a0, (-2 * cos)/a0, (1 - alpha)/a0 ];
  }
};

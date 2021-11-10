const db = require('../db');
const Movie = require('../media/Movie');
const Transcoding = require('./transcoding');
var AsyncLock = require('node-async-locks').AsyncLock;
const Logger = require('../logger');
const logger = new Logger().getInstance();

// A singleton class managing HLS Transcodings
class HlsManager {
    static lock = new AsyncLock();

    constructor() {
        // TODO: This shouldn't be a global variable, but haven't found a better way yet since it's used in multiple files.
        if (!global.transcodings) {
            global.transcodings = [];
        }
    }
    
    generateHash() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    getUniqueTranscodingHash() {
        let hash = this.generateHash();
        while (global.transcodings.some(transcoding => transcoding.hash === hash)) {
            hash = this.generateHash();
        }
        return hash;
    }

    startMovieTranscoding(movie, quality, startSegment, groupHash) {
        return new Promise(resolve => {
            movie.getFilePath()
            .then(filePath => {
                const hash = this.getUniqueTranscodingHash();
                const output = Transcoding.createTempDir();
                const fastTranscoding = new Transcoding(filePath, movie.movieId, startSegment, hash, groupHash, true);
                const slowTranscoding = new Transcoding(filePath, movie.movieId, startSegment + (Transcoding.FAST_START_TIME / Transcoding.SEGMENT_DURATION), hash, groupHash, false);
                global.transcodings.push(fastTranscoding);
                global.transcodings.push(slowTranscoding);
                const promises = [fastTranscoding.start(quality, output), slowTranscoding.start(quality, output)];
                Promise.all(promises).then(() => {
                    resolve();
                });
                /*
                fastTranscoding.start(quality)
                .then(() => {
                    resolve();
                });
                */
            })
        });
    }

    stopOtherVideoTranscodings(hash, quality) {
        let i = global.transcodings.length;
        let anythingStopped = false;
        while (i--) {
            if (global.transcodings[i].groupHash == hash &&
                global.transcodings[i].quality !== quality) {
                    global.transcodings[i].stop();
                    global.transcodings.splice(i, 1);
                    anythingStopped = true;
            }
        }
        return anythingStopped;
    }

    stopAllVideoTranscodings(hash) {
        let i = global.transcodings.length;
        while (i--) {
            if (global.transcodings[i].groupHash == hash) {
                    global.transcodings[i].stop();
                    global.transcodings.splice(i, 1);
            }
        }
    }

    setLastRequestedTime(hash) {
        for (let i = 0; i < global.transcodings.length; i++) {
            if (global.transcodings[i].groupHash === hash) {
                global.transcodings[i].lastRequestedTime = Date.now();
            }
        }
    }
    
    stopOldTranscodings() {
        const now = Date.now();
        let i = global.transcodings.length;
        while (i--) {
            const timeoutDate = new Date(global.transcodings[i].lastRequestedTime + Transcoding.TIMEOUT_TIME);
            if (timeoutDate <= now) {
                logger.DEBUG(`[HLS] Stopping old transcoding, group: ${global.transcodings[i].groupHash}`);
                global.transcodings[i].stop();
                global.transcodings.splice(i, 1);
            }
        }
    }

    getVideoTranscodingSegment(hash) {
        const transcoding = global.transcodings.find(transcoding => transcoding.groupHash === hash && !transcoding.fastStart);
        return transcoding.latestSegment;
    }

    getVideoTranscodingOutputPath(hash) {
        const transcoding = global.transcodings.find(transcoding => transcoding.groupHash === hash);
        return transcoding.getOutput();
    }

    getTranscodingStartSegment(hash) {
        const transcoding = global.transcodings.find(transcoding => transcoding.groupHash === hash);
        return transcoding.startSegment;
    }

    isTranscodingFinished(hash) {
        const transcoding = global.transcodings.find(transcoding => transcoding.groupHash === hash);
        if (transcoding == undefined) return false;
        return transcoding.finished;
    }

    isAnyVideoTranscodingActive(hash) {
        return global.transcodings.some(transcoding => transcoding.groupHash === hash);
    }

    isFastSeekingRunning(hash) {
        return global.transcodings.some(transcoding => transcoding.groupHash === hash && transcoding.fastStart && !transcoding.finished);
    }
}

module.exports = HlsManager;
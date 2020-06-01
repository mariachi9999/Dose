import fetch from 'node-fetch';

const db = require('../../../../lib/db');
const cors = require('../../../../lib/cors');
const jwtSecret = 'SERVERSECRET';
const jwt = require('jsonwebtoken');

export default (req, res) => {
    return new Promise(async (resolve) => {
        let serieID = req.query.serie;
        let poster = req.query.poster;
        let backdrop = req.query.backdrop;
        res = cors(res);

        // TODO: Error handling when imageID or movieID does not exist
        await db.none('UPDATE serie_image SET active = false WHERE serie_id = $1', [serieID]);
        if (poster != null) {
            db.none('UPDATE serie_image SET active = true WHERE serie_id = $1 AND image_id = $2', [serieID, poster]);
        }
        if (backdrop != null) {
            db.none('UPDATE serie_image SET active = true WHERE serie_id = $1 AND image_id = $2', [serieID, backdrop]);
        }
        res.status(200).json({success: true});
        resolve();
    });
}
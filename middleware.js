const jwt = require('jsonwebtoken');
const secret = 'ShhItsSecret';

const withAuth = function(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        res.status(401).send('Unauthorized: No token provided');
    } else {
        jwt.verify(token, secret, function(err, decoded) {
            if (err) {
                console.error('Token verification error:', err);
                res.status(401).send('Unauthorized: Invalid token');
            } else {
                console.log('Decoded token:', decoded);
                req.email = decoded.email;
                next();
            }
        });
    }
};




module.exports = withAuth;
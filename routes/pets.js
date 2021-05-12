// MODELS
const Pet = require('../models/pet');
const mailer = require('../utils/mailer');
const charge = require('../utils/charge')

// UPLOADING TO AWS S3
const multer  = require('multer');
const upload = multer({ dest: 'uploads/' });
const Upload = require('s3-uploader');

const client = new Upload(process.env.S3_BUCKET, {
    aws: {
      path: 'pets/avatar',
      region: process.env.S3_REGION,
      acl: 'public-read',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    cleanup: {
      versions: true,
      original: true
    },
    versions: [{
      maxWidth: 400,
      aspect: '16:10',
      suffix: '-standard'
    },{
      maxWidth: 300,
      aspect: '1:1',
      suffix: '-square'
    }]
  });

// PET ROUTES
module.exports = (app) => {

    // INDEX PET => index.js

    // NEW PET
    app.get('/pets/new', (req, res) => {
        res.render('pets-new');
    });

    // CREATE PET
  app.post('/pets', upload.single('avatar'), (req, res, next) => {
    var pet = new Pet(req.body);
    pet.save(function (err) {
      if (req.file) {
        // Upload the images
        client.upload(req.file.path, {}, function (err, versions, meta) {
          if (err) { return res.status(400).send({ err: err }) };

          // Pop off the -square and -standard and just use the one URL to grab the image
          versions.forEach(function (image) {
            var urlArray = image.url.split('-');
            urlArray.pop();
            var url = urlArray.join('-');
            pet.avatarUrl = url;
            pet.save();
          });

          res.send({ pet: pet });
        });
      } else {
        res.send({ pet: pet });
      }
    })
  })

    // SHOW PET
    app.get('/pets/:id', (req, res) => {
        Pet.findById(req.params.id).exec((err, pet) => {
            res.render('pets-show', { pet: pet });
        });
    });

    // EDIT PET
    app.get('/pets/:id/edit', (req, res) => {
        Pet.findById(req.params.id).exec((err, pet) => {
            res.render('pets-edit', { pet: pet });
        });
    });

    // UPDATE PET
    app.put('/pets/:id', (req, res) => {
        Pet.findByIdAndUpdate(req.params.id, req.body)
            .then((pet) => {
                if (req.file) {
                    client.upload(req.file.path, {}, function (err, versions, meta) {
                        if (err) { return res.status(400).send({ err: err }) };
              
                        // Pop off the -square and -standard and just use the one URL to grab the image
                        versions.forEach(function (image) {
                          var urlArray = image.url.split('-');
                          urlArray.pop();
                          var url = urlArray.join('-');
                          pet.avatarUrl = url;
                          pet.save();
                        });
                    })
                }
                res.redirect(`/pets/${pet._id}`)
            })
            .catch((err) => {
                res.send({err : err});
            });
    });

    // DELETE PET
    app.delete('/pets/:id', (req, res) => {
        Pet.findByIdAndRemove(req.params.id).exec((err, pet) => {
            return res.redirect('/')
        });
    });

    // SEARCH
    app.get('/search', function (req, res) {
        Pet
            .find(
                { $text : { $search : req.query.term } },
                { score : { $meta: "textScore" } }
            )
            .sort({ score : { $meta : 'textScore' } })
            .limit(20)
            .exec(function(err, pets) {
            if (err) { return res.status(400).send(err) }
    
            if (req.header('Content-Type') == 'application/json') {
                return res.json({ pets: pets });
            } else {
                return res.render('pets-index', { pets: pets, term: req.query.term });
            }
            });
    });

    // PURCHASE
    app.post('/pets/:id/purchase', (req, res) => {
        console.log(req.body);
        
        var stripe = require("stripe")(process.env.PRIVATE_STRIPE_API_KEY);

        // Token is created using Checkout or Elements!
        // Get the payment token ID submitted by the form:
        const token = req.body.stripeToken; // Using Express

        // req.body.petId can become null through seeding,
        // this way we'll insure we use a non-null value
        let petId = req.body.petId || req.params.id;

        Pet.findById(petId).exec((err, pet)=> {
            if (err) {
                console.log('Error: ' + err);
                res.redirect(`/pets/${req.params.id}`);
            }

            charge.chargeUser(pet, req, res)
            .then((chg) => {
                const user = {
                    email: req.body.stripeEmail,
                    amount: chg.amount / 100,
                    petName: pet.name
                };
                // Call our mail handler to manage sending emails
                mailer.sendMail(user, req, res);
                 
                pet.purchasedAt = Date.now();
                return pet.save()
            })
            .then(() => {
                return
            })
            .catch(err => {
                console.log('Error:' + err);
            });
        });
    })
}   

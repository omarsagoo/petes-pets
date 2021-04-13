var stripe = require("stripe")(process.env.PRIVATE_STRIPE_API_KEY);


module.exports.chargeUser = (pet, req, res) => {
    return new Promise((res, rej) => {
        // Token is created using Checkout or Elements!
        // Get the payment token ID submitted by the form:
        const token = req.body.stripeToken; // Using Express

        stripe.charges.create({
            amount: pet.price * 100,
            currency: 'usd',
            description: `Purchased ${pet.name}, ${pet.species}`,
            source: token,
        }).then((chg) => {
            res(chg)
        }).catch(err => {
            rej(err)
        })
    })
}
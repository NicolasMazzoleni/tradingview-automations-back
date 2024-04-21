
// example : https://dev.to/ericlecodeur/nodejs-express-partie-5-routes-et-controllers-18l

const test = ((req, res) => {
console.log('hello')
    res.json()
})

module.exports = {
    test
}
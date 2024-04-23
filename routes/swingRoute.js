const express = require('express')
const router = express.Router()

const  { 
    postSwing
} = require('../controllers/swingController.js')

router.post('/', postSwing)

// router.get('/:productID', getProduct)

// router.post('/', createProduct) 

// router.put('/:productID', updateProduct) 

// router.delete('/:productID', deleteProduct)

module.exports = router
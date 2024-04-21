const express = require('express')
const router = express.Router()

const  { 
    postScalping
} = require('../controllers/scalpingController.js')

router.post('/', postScalping)

// router.get('/:productID', getProduct)

// router.post('/', createProduct) 

// router.put('/:productID', updateProduct) 

// router.delete('/:productID', deleteProduct)

module.exports = router
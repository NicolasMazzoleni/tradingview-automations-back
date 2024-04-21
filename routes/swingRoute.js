const express = require('express')
const router = express.Router()

const  { 
    test
} = require('../controllers/swingController.js')

router.get('/', test)

// router.get('/:productID', getProduct)

// router.post('/', createProduct) 

// router.put('/:productID', updateProduct) 

// router.delete('/:productID', deleteProduct)

module.exports = router
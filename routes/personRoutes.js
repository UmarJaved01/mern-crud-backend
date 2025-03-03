const express = require('express')
const router = express.Router()
const Person = require('../models/Person')

// Get all persons
router.get('/', async (req, res) => {
  try {
    const persons = await Person.find()
    res.json(persons)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Create person
router.post('/', async (req, res) => {
  const person = new Person({
    name: req.body.name,
    age: req.body.age
  })
  try {
    const newPerson = await person.save()
    res.status(201).json(newPerson)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// Update person
router.put('/:id', async (req, res) => {
  try {
    const person = await Person.findById(req.params.id)
    if (!person) {
      return res.status(404).json({ message: 'Person not found' })
    }
    person.name = req.body.name || person.name
    person.age = req.body.age || person.age
    const updatedPerson = await person.save()
    res.json(updatedPerson)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// Delete person
router.delete('/:id', async (req, res) => {
  try {
    await Person.findByIdAndDelete(req.params.id)
    res.json({ message: 'Person deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
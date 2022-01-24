const fs = require('fs')
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')
const session = require('express-session')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const usersPath = `${ __dirname }/data/users.json`
const transactionsPath = `${ __dirname }/data/transactions.json`

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true }))
app.use(express.urlencoded({ extended: true }))



app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth')
  }
  
  let amount = 10000
  const users = require(usersPath)
  const transactions = require(transactionsPath)
  const userTransaction = transactions.filter(transaction => transaction.to == req.session.user.id || transaction.from == req.session.user.id)
  userTransaction.forEach(transaction => amount += transaction.to == req.session.user.id ? transaction.amount : -transaction.amount)

  res.render('home', {
    amount: amount,
    transactions: userTransaction,
    users: users,
    session: req.session.user
  })
})



app.get('/auth', (req, res) => {
  req.session.destroy()
  res.render('auth', { error: req.query.error })
})



app.post('/auth', (req, res) => {
  const users = require(usersPath)

  const user = users.find(user =>
    user.firstName == req.body.firstName.toLowerCase() &&
    user.lastName == req.body.lastName.toLowerCase() &&
    user.password == req.body.password
  )
  
  if (!user) {
    return res.redirect('/auth?error=auth')
  }
  
  req.session.user = user
  res.redirect('/')
})



io.on('connection', socket => {
  socket.on('transaction', transaction => {
    const users = require(usersPath)
    if (!users.find(user => user.id == transaction.to)) {
      return socket.emit('error')
    }
    
    const transactions = require(transactionsPath)
    transactions.push(transaction)
    
    try {
      fs.writeFileSync(transactionsPath, JSON.stringify(transactions))
      io.emit('success', {
        from: users.find(user => user.id == transaction.from),
        to: users.find(user => user.id == transaction.to),
        amount: transaction.amount,
        date: transaction.date
      })
    } catch (err) {
      socket.emit('error')
    }
  })
})



server.listen(80)
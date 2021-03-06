const WebTorrent = require('webtorrent')
var fs = require('fs')
const client = new WebTorrent()
const ipc = require('electron').ipcRenderer
const settings = require('electron-settings');

let loading = document.getElementById('loading')
let trayButton = document.getElementById('put-in-tray')
let progressBar = document.getElementById('progress')
let inputSources = document.getElementById('input-sources')
let reloadButton = document.getElementById('reload-page')
let trayOn = false

client.on('error', function (err) {
	console.error('Error: ' + err.message)
	loading.style.display = 'none';
	alert('An error occured. Please try again.')
	location.reload()
})

// Listen for a recent file or open file click and append that file to the DOM
ipc.on('open-file-reply', function (event, filePath) {

	var fileName = filePath.split('/').slice(-1)[0]

	document.getElementsByClassName('output')[0].innerHTML = ''

	if (fileName.endsWith('.mp4')) {
		log(fileName)
		log('<video controls autoplay><source src="' + filePath + '" type="video/mp4"></video>')
	} else if (fileName.endsWith('.torrent')) {
		var torrentId = filePath

		// Show loading spinner
		loading.style.display = 'block';

		ipc.send('downloads-path')

		ipc.on('downloads-path-reply', function (event, path) {
			const downloadsPath = path
			// Start downloading torrent, callback to onTorrent
			client.add(torrentId, { path: downloadsPath }, onTorrent)
		})
	}

	progressBar.value = 0
	progressBar.style.display = 'none'
})

// Listen for for input
document.querySelector('form').addEventListener('submit', function (e) {
	e.preventDefault()

	// Clear out contents
	document.getElementById('title').innerHTML = '';
	progressBar.value = 0
	progressBar.style.display = 'none'
	document.querySelector('.output').innerHTML = '';

	// Get magnet
	var torrentId = document.querySelector('form input[name=magnet]').value

	// Show loading spinner
	loading.style.display = 'block';

	ipc.send('downloads-path')

	ipc.on('downloads-path-reply', function (event, path) {
		const downloadsPath = path
		// Start downloading torrent, callback to onTorrent
		client.add(torrentId, { path: downloadsPath }, onTorrent)
	})
})

function onTorrent(torrent) {
	// Iterate over each file in torrent
	torrent.files.forEach(function (file) {
		console.log(file)
		inputSources.style.display = 'none'
		// If .mp3
		if (file.name.endsWith('.mp3')) {
			// Add file name to title element and append file to output - dont autoplay audio as there's usually multiple songs
			log(file.name)
			file.appendTo('.output', { autoplay: false })
		// If .mp4
		} else if (file.name.endsWith('.mp4')) {
			// Add file name to title element and append file to output
			log(file.name)
			file.appendTo('.output')
			ipc.send('new-file-added')
		}
		file.getBlobURL(function (err, url) {
			if (err) return log(err.message)
		})
	})

	// Hide loading spinner
	loading.style.display = 'none';

	// Every 5 seconds get download percentage and update progress bar
	var interval = setInterval(function () {
		if (trayOn) {
			ipc.send('put-in-tray', 'Downloading... ' + (torrent.progress * 100).toFixed(1) + '%', false)
		}
		ipc.send('set-badge', (torrent.progress * 100).toFixed(1))
		progressBar.style.display = 'block'
		progressBar.value = (torrent.progress * 100).toFixed(1)
	}, 3000)

	// When torrent is done, clear the interval
	torrent.on('done', function () {
		if (trayOn) {
			ipc.send('put-in-tray', 'Download Complete', false)
		}
		ipc.send('set-badge', '100')
		progressBar.value = 100
		clearInterval(interval)
		ipc.send('download-finished', torrent.name)
		if (settings.get('notification.checked')) {
			new Notification('Download Complete', { body: torrent.name })
		}
	})
}

function log(str) {
	var p = document.createElement('p')
	p.setAttribute("id", "title")
	p.innerHTML = str
	document.querySelector('.output').appendChild(p)
}

reloadButton.addEventListener("click", function() {
	location.reload()
    ipc.send('reload-clicked')
});


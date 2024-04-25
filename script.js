window.onload = function() {
    fetch('https://visitorcounterfa.azurewebsites.net/api/visitor')
        .then(response => response.json())
        .then(data => {
            document.getElementById('visitorCount').innerText = data.count;
        })
        .catch(error => console.error('Error fetching visitor count:', error));
};
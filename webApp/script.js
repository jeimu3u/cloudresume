window.onload = function() {
    fetch('https://visitorcounterfa.azurewebsites.net/api/visitorCounter')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (typeof data.count !== 'number') {
                throw new Error('Count is missing or not a number in the response');
            }
            document.getElementById('visitorCount').textContent = `Visitors: ${data.count}`;
        })
        .catch(error => {
            console.error('Error fetching visitor count:', error);
            document.getElementById('visitorCount').textContent = 'Visitor count unavailable';
        });
};
window.onload = function() {
    fetch('https://visitorcounterfa.azurewebsites.net/api/visitor')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.count === undefined) {
                throw new Error('Count is undefined in the response');
            }
            document.getElementById('visitorCount').innerText = data.count;
        })
        .catch(error => {
            console.error('Error fetching visitor count:', error);
            document.getElementById('visitorCount').innerText = 'Error';
        });
};
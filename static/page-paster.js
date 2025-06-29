// Paste header and footer into any page that includes this script 

// Paste HTML into the innerHTML of an element with a selector matching selectorToInsertInto
function pastePage(urlOfHtmlToPaste, selectorToInsertInto)
{
    fetch(urlOfHtmlToPaste)
        .then((response) => {
            return response.text();
        })
        .then((htmlText) => {

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");

            const responseString = doc.body.innerHTML;

            document.querySelector(selectorToInsertInto).innerHTML = responseString; 
        })
        .catch(error => {
            console.error('Failed to fetch page: ', error);
        });
}

pastePage("footer.html", "#footer-stub");
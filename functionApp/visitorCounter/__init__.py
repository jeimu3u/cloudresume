import azure.functions as func
import os
from azure.data.tables import TableServiceClient
import json
import logging

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Function started")
    try:
        connection_string = os.environ["COSMOSDB_CONNECTION_STRING"]
        logging.info(f"Connection string obtained: {connection_string}")
        
        table_name = "VisitorCounterDB"
        service = TableServiceClient.from_connection_string(conn_str=connection_string)
        table_client = service.get_table_client(table_name=table_name)

        logging.info("Querying entities...")
        entities = table_client.query_entities("PartitionKey eq 'Counter' and RowKey eq 'Visitor'", results_per_page=1)
        entity = next(entities, None)

        if entity is None:
            logging.info("No entity found, creating new one...")
            entity = {'PartitionKey': 'Counter', 'RowKey': 'Visitor', 'Count': 0}
            table_client.create_entity(entity)
        else:
            logging.info(f"Entity found: {entity}")

        entity['Count'] += 1
        logging.info(f"Incremented count: {entity['Count']}")
        table_client.update_entity(entity, mode='Replace')

        response_data = json.dumps({"count": entity['Count']})
        logging.info(f"Response data: {response_data}")
        return func.HttpResponse(response_data, mimetype="application/json", status_code=200)
    except Exception as e:
        logging.error(f"Error processing your request: {e}")
        error_message = json.dumps({"error": str(e)})
        return func.HttpResponse(error_message, mimetype="application/json", status_code=500)
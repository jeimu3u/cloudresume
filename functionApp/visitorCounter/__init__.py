import azure.functions as func
import os
from azure.data.tables import TableServiceClient
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # Setup the connection and table client
        connection_string = os.getenv("COSMOSDB_CONNECTION_STRING")
        service = TableServiceClient.from_connection_string(conn_str=connection_string)
        table_client = service.get_table_client(table_name="VisitorCounterDB")

        # Query the visitor count entity
        query = "PartitionKey eq 'Counter' and RowKey eq 'Visitor'"
        entities = table_client.query_entities(query, results_per_page=1)
        entity = next(entities, None)

        # Check if entity exists, convert 'Count' to int, increment, and save
        if entity is None:
            entity = {'PartitionKey': 'Counter', 'RowKey': 'Visitor', 'Count': 1}  # Assume int if creating new
        else:
            # Convert 'Count' from string to int before incrementing
            entity['Count'] = int(entity['Count']) + 1
        
        # Upsert the entity in the database
        table_client.upsert_entity(entity)

        # Return the updated count
        return func.HttpResponse(json.dumps({"count": entity['Count']}), mimetype="application/json", status_code=200)
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), mimetype="application/json", status_code=500)
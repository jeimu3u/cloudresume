import azure.functions as func
import os
from azure.data.tables import TableServiceClient
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        connection_string = os.environ["COSMOSDB_CONNECTION_STRING"]
        table_name = "VisitorCounterDB"
        
        service = TableServiceClient.from_connection_string(conn_str=connection_string)
        table_client = service.get_table_client(table_name=table_name)

        entities = table_client.query_entities("PartitionKey eq 'Counter' and RowKey eq 'Visitor'", results_per_page=1)
        entity = next(entities, None)

        if entity is None:
            entity = {'PartitionKey': 'Counter', 'RowKey': 'Visitor', 'Count': 0}
            table_client.create_entity(entity)

        entity['Count'] += 1
        table_client.update_entity(entity, mode='Replace')

        # Ensure that the count is converted to a string before concatenating or using in JSON.
        count_str = str(entity['Count'])

        return func.HttpResponse(
            json.dumps({"count": count_str}),  # Convert count to string safely before dumping to JSON
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        # Explicitly convert exception message to string in a safer manner
        error_message = json.dumps({"error": str(e)})
        return func.HttpResponse(
            error_message,
            mimetype="application/json",
            status_code=500
        )
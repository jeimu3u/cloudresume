import azure.functions as func
import os
from azure.data.tables import TableServiceClient
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    connection_string = os.environ["AzureWebJobsStorage"]
    table_name = "VisitorCounterDB"
    service = TableServiceClient.from_connection_string(conn_str=connection_string)
    table_client = service.get_table_client(table_name=table_name)

    # Retrieve and update the current count
    entities = table_client.query_entities("PartitionKey eq 'Counter' and RowKey eq 'Visitor'")
    entity = list(entities)[0]
    entity['Count'] += 1
    table_client.update_entity(entity)

    return func.HttpResponse(
        json.dumps({"count": entity['Count']}),
        mimetype="application/json",
        status_code=200
    )
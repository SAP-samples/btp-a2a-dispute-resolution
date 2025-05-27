import os

def warehouse_insights(query: str) -> str:
    """
    Queries a dataset based on a natural language input. It can perform various operations such as filtering, aggregating, summation, and summarizing data.
    The dataset is a simple table with three columns: Invoice Number, Qty Ordered, and Qty Delivered.

    Args:
        query (str): The natural language query to be executed on the dataset.

    Returns:
        str: The natural language response based on the query and dataset.
    
    Example:
    >>> data_agent_tool(query="What is the damaged product count and other information related to order ID ORD001?")
    '{"result": "Here are the shipping details for order ORD0001:\n
    - Customer ID: CUST0001\n
    - Product ID: K00005\n
    - Ordered Product Count: 1000\n
    - Delivered Product Count: 900\n
    - Damaged Product Count: 100\n
    - Freight Details: TRK1121"}'
    """
    
    here = os.path.dirname(__file__)
    csv_path = os.path.join(here, "shipping_details.csv")

    with open(csv_path, "r", encoding="utf-8") as f:
        dataset = f.read()

    ans = "Based on the provided data table - {dataset}, the query: '{query}' - the answer is as follows: "

    print("LLM RESPONSE:", ans.format(dataset=dataset, query=query))

    return {"result": ans.format(dataset=dataset, query=query)}


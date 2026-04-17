import re

input_file = 'bay.ts'   # Ensure this matches your file name
output_file = 'bay.ts'  # Overwrites the file with the new data

with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    pre = match.group(1)      # label: "
    label = match.group(2)    # Bay 9A IMED
    mid = match.group(3)      # ", customer: '
    customer = match.group(4) # IMED
    post = match.group(5)     # ',

    bay_name = label
    
    # If there is a customer, remove it from the label
    if customer:
        # Some customers are "SHINKAWA / NK", so we split by "/" and remove each part
        for part in customer.split('/'):
            part = part.strip()
            if part:
                # Case-insensitive replacement
                bay_name = re.sub(re.escape(part), '', bay_name, flags=re.IGNORECASE)
    
    # Clean up extra spaces left behind
    bay_name = re.sub(r'\s+', ' ', bay_name).strip()
    
    # Fallback: if the result is completely empty (e.g., label was just "DANAHER"), keep the original
    if not bay_name or bay_name == '-':
        bay_name = label

    # Inject the new bayName property right after customer
    return f'{pre}{label}{mid}{customer}{post} bayName: "{bay_name}",'

# Regex to capture the label and customer fields
pattern = r'(label:\s*["\'])(.*?)(["\'],\s*customer:\s*["\'])(.*?)(["\'],)'

new_content = re.sub(pattern, replacer, content)

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Successfully added 'bayName' to {output_file}")
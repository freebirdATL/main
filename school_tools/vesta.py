import requests
import json

message = "i love you most most most :)\n🟪🟪🟪🟪🟪🟩🟩🟩🟩🟩"

# [
#     [9, 0, 12, 15, 22, 5, 0, 25, 15, 21, 0, 13, 15, 19, 20, 0, 13, 15, 19, 20, 0, 13], # I need this m (13) to go next line!
#     [15, 19, 20, 0, 50, 42, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
#     [68, 68, 68, 68, 68,66, 66, 66, 66, 66, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
#     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
#     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
#     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
# ]

key = "ZGYyOTI5N2MtMjlmOS00NTBkLTg3NjgtNTFmMzE4YWIyNDJj"
url = "http://192.168.68.60:7000/local-api/message" #this ip address reserved in router

def build_vesta_map():
    vesta_keys = " ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$()-+&=;:'\"%,./?°🟥🟧🟨🟩🟦🟪□■" # "❤️" for 62 on VestaNOTE
    vesta_values = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34
                ,35,36,37,38,39,40,41,42,44,46,47,48,49,50,52,53,54,55,56,59,60,62,63,64,65,66,67,68,69,70]
    return dict(zip(vesta_keys,vesta_values))


def encode_message(message, map, display_rows, display_cols):
    message_display = [[0 for _ in range(display_cols)] for _ in range(display_rows)]
    message = message.upper()
    row = 0
    col = 0
    i = 0
    length = len(message)
    #for char in message.upper():
    while i < length:
        if message[i] == "\n":
            move_to = i // 22 * 22 + 22 # this yields starting point for next character
            insert_space_count = move_to - i
            for j in range(insert_space_count):
                message[i + j] = " "
            continue

        message_display[row][col] = map.get(message[i], 0)
        
        if (col != 0) and (col%21 == 0):
            row += 1
            col = 0
        else:
            col += 1
        
        if row == 6:
            break
        i += 1
    return message_display

def sendMessage(encoded_message):
    response = requests.post(url, headers = {"X-Vestaboard-Local-Api-Key":key, "Content-Type":"application/json"}, json = encoded_message)
    return response.text


vesta_map = build_vesta_map()
encoded_message = encode_message(message, vesta_map, 6, 22)
print(f"encoded_message: {encoded_message}")

# vestaboard_response = sendMessage(encoded_message)
# print(vestaboard_response)
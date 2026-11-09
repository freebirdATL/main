import requests
import json
import sys

message = sys.argv[1]
key = "ZGYyOTI5N2MtMjlmOS00NTBkLTg3NjgtNTFmMzE4YWIyNDJj"
url = "http://192.168.68.60:7000/local-api/message" #this ip address reserved in router

class Vestaboard:
    def __init__(self, endpoint, api_key, display_rows=6, display_cols=22):
        self.endpoint = endpoint
        self.api_key = api_key
        self.display_rows = display_rows
        self.display_cols = display_cols
        vesta_keys = " ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$()-+&=;:'\"%,./?°🟥🟧🟨🟩🟦🟪□■" # "❤️" for 62 on VestaNOTE
        vesta_values = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34
                    ,35,36,37,38,39,40,41,42,44,46,47,48,49,50,52,53,54,55,56,59,60,62,63,64,65,66,67,68,69,70]
        self.vesta_map = dict(zip(vesta_keys,vesta_values))

    def layout_message(self, message):
        self.message = message.replace("\\n","\n").replace("\\t","    ").upper()
        self.message_layout = [[" " for _ in range(self.display_cols)] for _ in range(self.display_rows)] #instantiate 2-D array
        
        msg_length = len(self.message)
        row = 0
        col = 0

        i = 0
        while i < msg_length:
            i_char = self.message[i]

            if col >= self.display_cols:
                row += 1
                col = 0

            if i_char == " ":
                self.message_layout[row][col] = i_char
                col += 1
                i += 1
            elif i_char == "\n":
                row += 1
                col = 0
                i += 1
            else:
                j = i #end of current word
                while True:
                    if j == (msg_length-1) or self.message[j+1] in [" ", "\n"]:
                        break
                    j += 1
                if (col + (j-i)) >= self.display_cols:
                    row += 1
                    col = 0
                self.message_layout[row][col:(col+(j-i)+1)] = self.message[i:j+1]
                col = col+(j-i)+1
                i = j +1
        return self.message_layout


    def encode_message(self):
        """convert a message with finalized layout from text to encoded values for vestaboard"""
        self.encoded_message = self.message_layout.copy()
        for i in range(self.display_rows):
            for j in range(self.display_cols):
                self.encoded_message[i][j] = self.vesta_map.get(self.encoded_message[i][j], 0)
        return self.encoded_message


    def sendMessage(self):
        body = {"characters":self.encoded_message, "strategy":"column"}
        response = requests.post(url = self.endpoint,
                                headers = {"X-Vestaboard-Local-Api-Key":key,"Content-Type":"application/json"},
                                json = body
                                )
        return response.text

def main():
    board = Vestaboard(url, key)
    
    print("***updated msg layout:***")
    for __r in board.layout_message(message):
        print("|","".join(__r),"\t|",)

    print("***encoded msg:***")
    for __c in board.encode_message():
        print(__c)

    board.sendMessage()
    print("msg sent!")

if __name__ == "__main__":
    main()
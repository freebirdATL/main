// all even number 2->100

public class Evens {
    public static void main(String[] args) {
        for (int i = 2; i <= 100; i+=2) {
            System.out.print(i + "\n");
        }
        //----------------
        int line = 0;
        while (line <= 50) {
            System.out.print((line*2) + "\n");
            line ++;
        }
        //----------------
        int a = 2;
        for(int i = 0; i < 50; i++) {
            System.out.print(a);
            a = a+2;
        }
        //----------------
        for(int i = 2; i < 101; i++) {
            if((i%2) == 0) {System.out.print(i + "\n");}
        }
    }
}
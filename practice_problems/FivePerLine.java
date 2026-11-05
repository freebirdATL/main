// __Write a program FivePerLine.java that, using one for loop and one if statement,
//  prints the integers from 1000 to 2000 with five integers per line.
// Hint: use the % operator.

public class FivePerLine {
    public static void main(String[] args) {
        for(int i = 1000; i <= 2000; i++) {
            if(i%5 == 0) {System.out.print("\n");}
            System.out.print(i + ", ");
        }
    }
}
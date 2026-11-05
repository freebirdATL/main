//__Write a program AllEqual.java that takes three integer command-line arguments
//and prints equal if all three are equal, and not equal otherwise.

public class AllEqual {
    public static void main(String[] args) {
        int input1 = Integer.parseInt(args[0]);
        int input2 = Integer.parseInt(args[1]);
        int input3 = Integer.parseInt(args[2]);

        boolean allEqual = (input1 == input2) && (input2 == input3);

        String message;
        if (allEqual) {message = "equal :)";}
        else {message = "NOT equal :(";}

        System.out.print(message);
    }
}
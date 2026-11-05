// __Rewrite TenHellos.java to make a program Hellos.java that takes the number of lines
//  to print as a command-line argument. You may assume that the argument is less than 1000.
public class TenHellos {
    public static void main(String[] args) {
        int n = Integer.parseInt(args[0]);
        
        for(int i = 0; i < n; i++) {
            System.out.print("Hello!\n");
        }
    }
}
// __Write a program FunctionGrowth.java that prints a table of the values of
//  ln n, n, n ln n, n2, n3 for n = 2, 4, 8, 16, ..., 2048.
//   Use tabs ('\t' characters) to line up columns.

public class FunctionGrowth {
    public static void main(String[] args) {
        System.out.print("ln n\tn\tn ln n\tn2\tn3\n");
        for(long i = 2; i <= 2048; i*=2) {
            System.out.print((long)Math.log(i) + "\t");
            System.out.print(i + "\t");
            System.out.print((long)(i * Math.log(i)) + "\t");
            System.out.print(i*i + "\t");
            System.out.print(i*i*i + "\t");
            System.out.print("\n");
        }
    }
}